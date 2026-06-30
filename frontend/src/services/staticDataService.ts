/**
 * Static data service for client-side analysis
 * Replaces API calls with local JSON data processing
 */

export interface LiveShow {
  id: number;
  date: string;
  performance_name: string;
  venue: string;
  url?: string;
  tour_id?: string;
}

export interface Tour {
  id: string;
  name: string;
}

export interface Song {
  id: number;
  name: string;
  song_url?: string;
}

export interface Performance {
  h: number;  // live_history_id (shortened)
  s: number;  // live_song_id (shortened)
  o?: number; // song_order (shortened, optional)
}

export interface SongAnalysis {
  id: number;
  song_name: string;
  hit_count: number;
  total_appearances: number;
  selection_rate: number;
  latest_performance: string;
  latest_venue: string;
}

export interface LatestPerformance {
  latest_performance: string;
  latest_venue: string;
  latest_date: string;
}

// Computed statistics interface
export interface SongStats {
  total_appearances: number;
  selection_rate: number;
}

export interface TourMatrixSong {
  id: number;
  name: string;
  hitCount: number;
  firstPosition: number;
  // Map of show_id -> song_order (when the song appeared). Absent key = not played.
  cells: Record<number, number>;
}

export interface TourMatrix {
  shows: LiveShow[]; // chronological ascending
  songs: TourMatrixSong[]; // sorted core-first, rotation, one-off
}

export interface SongDetail {
  song: Song;
  all_time_plays: number;
  play_rate: number; // all_time_plays / total_shows, 0..1
  debut_year: string | null; // YYYY
  latest_show: LiveShow | null;
  tours_played_in: number;
  total_tours: number;
  timeline: { year: string; count: number }[]; // sorted year desc (recent first)
  recent_appearances: LiveShow[]; // up to 5, date desc
}

class StaticDataService {
  private shows: LiveShow[] = [];
  private songs: Song[] = [];
  private performances: Performance[] = [];
  private tours: Tour[] = [];
  private toursMap: Map<string, Tour> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  // Computed indices for performance optimization
  private showsMap: Map<number, LiveShow> = new Map();
  private songsMap: Map<number, Song> = new Map();
  private performancesByShow: Map<number, number[]> = new Map();
  private performancesBySong: Map<number, number[]> = new Map();
  private songStats: Map<number, SongStats> = new Map();

  /**
   * Load all static data files. Concurrent callers share the same in-flight
   * Promise so we never trigger duplicate fetches.
   */
  async loadData(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const [showsResponse, songsResponse, performancesResponse, toursResponse] =
          await Promise.all([
            fetch('/data/shows.json'),
            fetch('/data/songs.json'),
            fetch('/data/performances.json'),
            fetch('/data/tours.json').catch(() => null),
          ]);

        this.shows = await showsResponse.json();
        this.songs = await songsResponse.json();
        this.performances = await performancesResponse.json();
        this.tours = toursResponse && toursResponse.ok ? await toursResponse.json() : [];
        this.toursMap.clear();
        this.tours.forEach((t) => this.toursMap.set(t.id, t));

        this.buildIndices();
        this.isLoaded = true;
      } catch (error) {
        // Allow a retry after failure.
        this.loadPromise = null;
        console.error('Failed to load static data:', error);
        throw error;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Build performance indices for optimization
   */
  private buildIndices(): void {
    // Clear existing indices
    this.showsMap.clear();
    this.songsMap.clear();
    this.performancesByShow.clear();
    this.performancesBySong.clear();
    this.songStats.clear();

    // Build shows and songs maps
    this.shows.forEach(show => this.showsMap.set(show.id, show));
    this.songs.forEach(song => this.songsMap.set(song.id, song));

    // Build performance indices
    this.performances.forEach(perf => {
      // Group by show
      if (!this.performancesByShow.has(perf.h)) {
        this.performancesByShow.set(perf.h, []);
      }
      this.performancesByShow.get(perf.h)!.push(perf.s);

      // Group by song
      if (!this.performancesBySong.has(perf.s)) {
        this.performancesBySong.set(perf.s, []);
      }
      this.performancesBySong.get(perf.s)!.push(perf.h);
    });

    // Pre-compute song statistics
    this.songs.forEach(song => {
      const appearances = this.performancesBySong.get(song.id)?.length || 0;
      const selectionRate = this.shows.length > 0 ? appearances / this.shows.length : 0;
      this.songStats.set(song.id, {
        total_appearances: appearances,
        selection_rate: Number(selectionRate.toFixed(3))
      });
    });
  }

  /**
   * Get computed statistics for a song
   */
  private getSongStats(songId: number): SongStats {
    return this.songStats.get(songId) || { total_appearances: 0, selection_rate: 0 };
  }

  /**
   * Get latest performance info for a song
   */
  private getLatestPerformance(songId: number): LatestPerformance {
    const showIds = this.performancesBySong.get(songId) || [];
    if (showIds.length === 0) {
      return {
        latest_performance: 'Unknown',
        latest_venue: 'Unknown',
        latest_date: ''
      };
    }

    // Find the latest show by comparing dates (not IDs)
    let latestShow: LiveShow | undefined;
    let latestDate = '';
    
    for (const showId of showIds) {
      const show = this.showsMap.get(showId);
      if (show && (!latestDate || show.date > latestDate)) {
        latestShow = show;
        latestDate = show.date;
      }
    }
    
    return {
      latest_performance: latestShow?.performance_name || 'Unknown',
      latest_venue: latestShow?.venue || 'Unknown',
      latest_date: latestShow?.date || ''
    };
  }

  /**
   * Analyze songs for selected shows
   */
  async analyzeSongs(showIds: number[]): Promise<{
    songs: SongAnalysis[];
    completion_rate: number;
    total_songs: number;
    heard_songs: number;
  }> {
    await this.loadData();

    // Single pass: walk each selected show once, accumulate hit_count per song.
    const hitCounts = new Map<number, number>();
    showIds.forEach((showId) => {
      const songIds = this.performancesByShow.get(showId);
      if (!songIds) return;
      songIds.forEach((songId) => {
        hitCounts.set(songId, (hitCounts.get(songId) || 0) + 1);
      });
    });

    const analysisResults: SongAnalysis[] = [];
    hitCounts.forEach((hitCount, songId) => {
      const song = this.songsMap.get(songId);
      if (!song) return;
      const stats = this.getSongStats(songId);
      const latest = this.getLatestPerformance(songId);
      analysisResults.push({
        id: song.id,
        song_name: song.name,
        hit_count: hitCount,
        total_appearances: stats.total_appearances,
        selection_rate: stats.selection_rate,
        latest_performance: latest.latest_performance,
        latest_venue: latest.latest_venue,
      });
    });

    analysisResults.sort((a, b) => b.hit_count - a.hit_count);

    const totalUniqueSongs = this.songs.length;
    const heardSongs = analysisResults.length;
    const completionRate = totalUniqueSongs > 0 ? heardSongs / totalUniqueSongs : 0;

    return {
      songs: analysisResults,
      completion_rate: completionRate,
      total_songs: totalUniqueSongs,
      heard_songs: heardSongs,
    };
  }

  /**
   * Reverse analysis - find songs NOT in selected shows
   */
  async analyzeReverseSongs(showIds: number[]): Promise<{
    songs: SongAnalysis[];
    completion_rate: number;
    total_songs: number;
    never_heard_songs: number;
  }> {
    await this.loadData();

    // Find songs that appear in selected shows using optimized indices
    const heardSongIds = new Set<number>();
    showIds.forEach(showId => {
      const songIds = this.performancesByShow.get(showId) || [];
      songIds.forEach(songId => heardSongIds.add(songId));
    });

    // Find songs that were never heard in selected shows but have historical appearances
    const neverHeardSongs = this.songs.filter(song => {
      const stats = this.getSongStats(song.id);
      return !heardSongIds.has(song.id) && stats.total_appearances > 0;
    });

    // Convert to analysis format
    const analysisResults: SongAnalysis[] = neverHeardSongs.map(song => {
      const stats = this.getSongStats(song.id);
      const latest = this.getLatestPerformance(song.id);

      return {
        id: song.id,
        song_name: song.name,
        hit_count: 0, // Always 0 for reverse analysis
        total_appearances: stats.total_appearances,
        selection_rate: stats.selection_rate,
        latest_performance: latest.latest_performance,
        latest_venue: latest.latest_venue
      };
    });

    // Sort by selection rate descending (songs with high historical rate but not heard)
    analysisResults.sort((a, b) => b.selection_rate - a.selection_rate);

    // Calculate completion rate (percentage of songs never heard)
    const totalUniqueSongs = this.songs.length;
    const neverHeardCount = analysisResults.length;
    const completionRate = totalUniqueSongs > 0 ? neverHeardCount / totalUniqueSongs : 0;

    return {
      songs: analysisResults,
      completion_rate: completionRate,
      total_songs: totalUniqueSongs,
      never_heard_songs: neverHeardCount
    };
  }

  /**
   * Get all shows sorted by date descending
   */
  async getAllShows(): Promise<LiveShow[]> {
    await this.loadData();
    
    // Sort by date descending
    return this.shows.toSorted((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Group shows by their manually-assigned tour_id. Display name comes from
   * tours.json; shows missing a tour_id fall back to their performance_name
   * as a singleton group (which makes orphans easy to spot in the UI).
   */
  async getGroupedShows(): Promise<{ groupName: string; shows: LiveShow[] }[]> {
    await this.loadData();

    const sortedShows = this.shows.toSorted((a, b) => b.date.localeCompare(a.date));

    const groups = new Map<string, LiveShow[]>();
    sortedShows.forEach((show) => {
      const key = show.tour_id || `__orphan_${show.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(show);
    });

    return Array.from(groups.entries())
      .map(([key, shows]) => {
        const tour = this.toursMap.get(key);
        return {
          groupName: tour ? tour.name : shows[0].performance_name,
          shows: shows.sort((a, b) => b.date.localeCompare(a.date)),
        };
      })
      .sort((a, b) => b.shows[0].date.localeCompare(a.shows[0].date));
  }

  /**
   * Build a tour matrix: songs × shows.
   * Input is a list of show IDs (typically all shows of one tour group).
   * Output is sorted by hit count desc, then by first appearance position asc,
   * so core songs naturally float to the top.
   */
  async getTourMatrix(showIds: number[]): Promise<TourMatrix> {
    await this.loadData();

    const showsAsc = showIds
      .map((id) => this.showsMap.get(id))
      .filter((s): s is LiveShow => !!s)
      .sort((a, b) => a.date.localeCompare(b.date));

    const showIdSet = new Set(showsAsc.map((s) => s.id));

    // song_id -> Map<show_id, position>
    const songToCells = new Map<number, Map<number, number>>();

    this.performances.forEach((p) => {
      if (!showIdSet.has(p.h)) return;
      if (!songToCells.has(p.s)) {
        songToCells.set(p.s, new Map());
      }
      songToCells.get(p.s)!.set(p.h, p.o ?? 0);
    });

    const songs: TourMatrixSong[] = Array.from(songToCells.entries())
      .map(([songId, cells]) => {
        const song = this.songsMap.get(songId);
        if (!song) return null;
        const positions = Array.from(cells.values()).filter((n) => n > 0);
        const firstPosition = positions.length > 0 ? Math.min(...positions) : 999;
        return {
          id: songId,
          name: song.name,
          hitCount: cells.size,
          firstPosition,
          cells: Object.fromEntries(cells),
        } as TourMatrixSong;
      })
      .filter((s): s is TourMatrixSong => s !== null)
      // Read top-to-bottom like the show progresses: slot 1 first, encore last.
      // Within a slot (alternates), the more-played one wins the top row.
      .sort((a, b) => {
        if (a.firstPosition !== b.firstPosition) return a.firstPosition - b.firstPosition;
        if (b.hitCount !== a.hitCount) return b.hitCount - a.hitCount;
        return a.name.localeCompare(b.name);
      });

    return {
      shows: showsAsc,
      songs,
    };
  }

  /**
   * Detailed lifetime stats for a single song: all-time play count,
   * debut / latest show, year-by-year timeline, recent appearances.
   * All derived from current static data — no extra fields required.
   */
  async getSongDetail(songId: number): Promise<SongDetail | null> {
    await this.loadData();

    const song = this.songsMap.get(songId);
    if (!song) return null;

    const showIds = this.performancesBySong.get(songId) || [];
    const shows = showIds
      .map((id) => this.showsMap.get(id))
      .filter((s): s is LiveShow => !!s);

    if (shows.length === 0) {
      return {
        song,
        all_time_plays: 0,
        play_rate: 0,
        debut_year: null,
        latest_show: null,
        tours_played_in: 0,
        total_tours: this.tours.length,
        timeline: [],
        recent_appearances: [],
      };
    }

    const showsByDateAsc = shows.toSorted((a, b) => a.date.localeCompare(b.date));
    const debutYear = showsByDateAsc[0].date.slice(0, 4);
    const latestShow = showsByDateAsc[showsByDateAsc.length - 1];

    const tourIds = new Set(
      shows.map((s) => s.tour_id).filter((t): t is string => !!t),
    );

    // Year -> count
    const yearCount = new Map<string, number>();
    shows.forEach((s) => {
      const y = s.date.slice(0, 4);
      yearCount.set(y, (yearCount.get(y) || 0) + 1);
    });
    const timeline = Array.from(yearCount.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year.localeCompare(a.year));

    const recent = shows
      .toSorted((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    return {
      song,
      all_time_plays: shows.length,
      play_rate: this.shows.length > 0 ? shows.length / this.shows.length : 0,
      debut_year: debutYear,
      latest_show: latestShow,
      tours_played_in: tourIds.size,
      total_tours: this.tours.length,
      timeline,
      recent_appearances: recent,
    };
  }

  /**
   * Get basic statistics
   */
  async getStats(): Promise<{
    total_shows: number;
    total_songs: number;
    total_performances: number;
  }> {
    await this.loadData();
    
    return {
      total_shows: this.shows.length,
      total_songs: this.songs.length,
      total_performances: this.performances.length
    };
  }
}

// Export singleton instance
export const staticDataService = new StaticDataService();

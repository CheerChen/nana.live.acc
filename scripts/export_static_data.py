#!/usr/bin/env python3
"""
Export database data to static JSON files for frontend consumption
"""

import json
import os
import psycopg
from typing import List, Dict, Any

def get_db_connection():
    """Get database connection"""
    return psycopg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        dbname=os.getenv('DB_NAME', 'nanalive_db'),
        user=os.getenv('DB_USER', 'nanalive_user'),
        password=os.getenv('DB_PASSWORD', 'password')
    )

def export_shows_data() -> List[Dict[str, Any]]:
    """Export all live shows data"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, date, performance_name, venue, url
                FROM live_history
                ORDER BY date DESC
            """)
            
            shows = []
            for row in cursor.fetchall():
                shows.append({
                    'id': row[0],
                    'date': row[1].isoformat() if row[1] else None,
                    'performance_name': row[2],
                    'venue': row[3],
                    'url': row[4]
                })
            
            return shows

def export_songs_data() -> List[Dict[str, Any]]:
    """Export songs data with only basic information (no calculated fields)"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # Get only basic song information, remove calculated fields
            cursor.execute("""
                SELECT 
                    ls.id,
                    ls.name,
                    ls.song_url
                FROM live_song ls
                ORDER BY ls.name ASC
            """)
            
            songs = []
            for row in cursor.fetchall():
                song_data = {
                    'id': row[0],
                    'name': row[1]
                }
                # Only include song_url if it's not null
                if row[2]:
                    song_data['song_url'] = row[2]
                songs.append(song_data)
            
            return songs

def export_performance_data() -> List[Dict[str, Any]]:
    """Export minimized performance relationships (remove redundant fields)"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    lhs.live_history_id,
                    lhs.live_song_id,
                    lhs.song_order
                FROM live_history_song lhs
                ORDER BY lhs.live_history_id ASC, lhs.song_order ASC
            """)
            
            performances = []
            for row in cursor.fetchall():
                perf_data = {
                    'h': row[0],  # live_history_id (shortened field name)
                    's': row[1]   # live_song_id (shortened field name)
                }
                # Only include song_order if it's not null
                if row[2] is not None:
                    perf_data['o'] = row[2]  # song_order (shortened field name)
                performances.append(perf_data)
            
            return performances

def export_latest_performances() -> Dict[int, Dict[str, Any]]:
    """Export latest performance info for each song"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT ON (ls.id)
                    ls.id,
                    lh.performance_name,
                    lh.venue,
                    lh.date
                FROM live_song ls
                JOIN live_history_song lhs ON ls.id = lhs.live_song_id
                JOIN live_history lh ON lhs.live_history_id = lh.id
                ORDER BY ls.id, lh.date DESC
            """)
            
            latest_performances = {}
            for row in cursor.fetchall():
                latest_performances[row[0]] = {
                    'latest_performance': row[1],
                    'latest_venue': row[2],
                    'latest_date': row[3].isoformat() if row[3] else None
                }
            
            return latest_performances

def main():
    """Main export function"""
    print("Starting data export...")
    
    # Create output directory
    output_dir = "frontend/public/data"
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Export shows data (compact JSON)
        print("Exporting shows data...")
        shows = export_shows_data()
        with open(f"{output_dir}/shows.json", 'w', encoding='utf-8') as f:
            json.dump(shows, f, ensure_ascii=False, separators=(',', ':'))  # Compact JSON
        print(f"Exported {len(shows)} shows")
        
        # Export songs data (compact JSON)
        print("Exporting songs data...")
        songs = export_songs_data()
        with open(f"{output_dir}/songs.json", 'w', encoding='utf-8') as f:
            json.dump(songs, f, ensure_ascii=False, separators=(',', ':'))  # Compact JSON
        print(f"Exported {len(songs)} songs")
        
        # Export performance relationships
        print("Exporting performance data...")
        performances = export_performance_data()
        with open(f"{output_dir}/performances.json", 'w', encoding='utf-8') as f:
            json.dump(performances, f, ensure_ascii=False, separators=(',', ':'))  # Compact JSON
        print(f"Exported {len(performances)} performance records")
        
        # Remove latest_performances.json export (will be calculated in TS)
        # print("Exporting latest performances...")
        # latest_performances = export_latest_performances()
        # with open(f"{output_dir}/latest_performances.json", 'w', encoding='utf-8') as f:
        #     json.dump(latest_performances, f, ensure_ascii=False, indent=2)
        # print(f"Exported latest performance data for {len(latest_performances)} songs")
        
        # Export metadata (compact JSON)
        metadata = {
            'export_date': '2025-01-01T00:00:00Z',  # Will be updated by build process
            'total_shows': len(shows),
            'total_songs': len(songs),
            'total_performances': len(performances)
        }
        with open(f"{output_dir}/metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, separators=(',', ':'))  # Compact JSON
        
        print("✅ Data export completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during export: {e}")
        raise

if __name__ == "__main__":
    main()

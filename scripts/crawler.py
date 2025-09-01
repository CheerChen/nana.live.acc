import os
import requests
from bs4 import BeautifulSoup
import psycopg
from urllib.parse import urljoin, quote
import re
from datetime import datetime
import time

# 自动加载 .env 文件
def load_env_file():
    """加载 .env 文件中的环境变量"""
    env_file = '.env'
    if os.path.exists(env_file):
        print("发现 .env 文件，正在加载环境变量...")
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()
        print("环境变量加载完成")
    else:
        print("未找到 .env 文件，使用系统环境变量")

# 在类定义前加载环境变量
load_env_file()

class NanaLiveAnalyzer:
    def __init__(self):
        # 数据库连接配置 - 从环境变量获取
        self.db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'nanalive'),
            'port': os.getenv('DB_PORT', '5432')
        }
        self.base_url = 'https://anifesdb.net'
        self.main_url = 'https://anifesdb.net/live/%E6%B0%B4%E6%A8%B9%E5%A5%88%E3%80%85/'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # 歌曲缓存字典，避免重复查询数据库
        self.song_cache = {}  # {song_name: song_id}
        self._load_existing_songs()
        
    def get_db_connection(self):
        """获取数据库连接"""
        return psycopg.connect(
            host=self.db_config['host'],
            user=self.db_config['user'],
            password=self.db_config['password'],
            dbname=self.db_config['database'],
            port=self.db_config['port']
        )
    
    def _load_existing_songs(self):
        """加载已存在的歌曲到缓存中"""
        print("加载已存在的歌曲到缓存...")
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT id, name FROM live_song")
            results = cursor.fetchall()
            for song_id, song_name in results:
                self.song_cache[song_name] = song_id
            print(f"已加载 {len(self.song_cache)} 首歌曲到缓存")
        except Exception as e:
            print(f"加载歌曲缓存出错: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def parse_date(self, date_str):
        """解析日期字符串"""
        try:
            # 尝试解析不同的日期格式
            for fmt in ['%Y-%m-%d', '%Y年%m月%d日', '%Y/%m/%d']:
                try:
                    return datetime.strptime(date_str.strip(), fmt).date()
                except ValueError:
                    continue
            
            # 如果上面的格式都不匹配，尝试用正则提取数字
            match = re.search(r'(\d{4})[^\d]*(\d{1,2})[^\d]*(\d{1,2})', date_str)
            if match:
                year, month, day = match.groups()
                return datetime(int(year), int(month), int(day)).date()
            
            print(f"无法解析日期: {date_str}")
            return None
        except Exception as e:
            print(f"解析日期出错: {date_str}, 错误: {e}")
            return None
    
    def get_live_history(self):
        """获取演出历史列表"""
        print("开始获取演出历史列表...")
        response = self.session.get(self.main_url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # 查找包含演出历史的表格
        table = soup.find('table', class_='table-fixed')
        if not table:
            print("未找到演出历史表格")
            return []
        
        live_history = []
        rows = table.find_all('tr')[1:]  # 跳过表头
        
        for row in rows:
            cells = row.find_all('td')
            if len(cells) >= 3:
                date_str = cells[0].get_text(strip=True)
                performance_name = cells[1].get_text(strip=True)
                venue = cells[2].get_text(strip=True)
                
                # 查找详情页面链接
                link_element = cells[1].find('a')
                detail_url = None
                if link_element and link_element.get('href'):
                    detail_url = urljoin(self.base_url, link_element.get('href'))
                
                # 解析日期
                parsed_date = self.parse_date(date_str)
                
                if parsed_date:
                    live_history.append({
                        'date': parsed_date,
                        'performance_name': performance_name,
                        'venue': venue,
                        'url': detail_url
                    })
                    print(f"发现演出: {parsed_date} - {performance_name}")
        
        print(f"总共找到 {len(live_history)} 场演出")
        return live_history
    
    def get_songs_from_detail_page(self, url):
        """从详情页面获取歌曲列表"""
        if not url:
            return []
        
        print(f"获取详情页面歌曲: {url}")
        try:
            response = self.session.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 查找第一个包含歌曲列表的表格
            tables = soup.find_all('table', class_='table-fixed')
            for table in tables:
                # 检查是否包含楽曲名列
                headers = table.find_all('th')
                if any('楽曲名' in th.get_text() for th in headers):
                    songs_with_info = []
                    rows = table.find_all('tr')[1:]  # 跳过表头
                    
                    last_song_index = -1  # 记录最后一首歌曲的索引
                    
                    for row in rows:
                        cells = row.find_all('td')
                        if len(cells) >= 2:
                            # 检查第二列是否包含歌曲链接
                            song_cell = cells[1]
                            song_link = song_cell.find('a')
                            
                            if song_link and song_link.get('href'):
                                # 这是一首歌曲
                                song_name = song_link.get_text(strip=True)
                                song_url = urljoin(self.base_url, song_link.get('href'))
                                
                                songs_with_info.append({
                                    'name': song_name,
                                    'url': song_url,
                                    'remark': None
                                })
                                last_song_index = len(songs_with_info) - 1
                                
                            else:
                                # 这可能是备注行
                                remark_text = song_cell.get_text(strip=True)
                                if remark_text and last_song_index >= 0:
                                    # 将备注添加到最后一首歌曲
                                    if songs_with_info[last_song_index]['remark']:
                                        songs_with_info[last_song_index]['remark'] += f"; {remark_text}"
                                    else:
                                        songs_with_info[last_song_index]['remark'] = remark_text
                    
                    print(f"从详情页面获取到 {len(songs_with_info)} 首歌曲")
                    return songs_with_info
            
            print("未在详情页面找到歌曲列表")
            return []
            
        except Exception as e:
            print(f"获取详情页面出错: {url}, 错误: {e}")
            return []
    
    def save_live_history(self, live_data):
        """保存演出历史到数据库"""
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # 插入演出历史
            insert_sql = """
                INSERT INTO live_history (date, performance_name, venue, url) 
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (date, performance_name) DO UPDATE SET
                performance_name = EXCLUDED.performance_name,
                venue = EXCLUDED.venue,
                url = EXCLUDED.url
                RETURNING id
            """
            
            cursor.execute(insert_sql, (
                live_data['date'],
                live_data['performance_name'],
                live_data['venue'],
                live_data['url']
            ))
            
            result = cursor.fetchone()
            live_history_id = result[0] if result else None
            
            conn.commit()
            return live_history_id
            
        except Exception as e:
            conn.rollback()
            print(f"保存演出历史出错: {e}")
            return None
        finally:
            cursor.close()
            conn.close()
    
    def save_song(self, song_name, song_url=None):
        """保存歌曲到数据库，使用缓存优化"""
        # 先检查缓存
        if song_name in self.song_cache:
            return self.song_cache[song_name]
        
        # 缓存中没有，插入数据库
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            insert_sql = """
                INSERT INTO live_song (name, song_url) 
                VALUES (%s, %s)
                ON CONFLICT (name) DO UPDATE SET
                song_url = EXCLUDED.song_url
                RETURNING id
            """
            cursor.execute(insert_sql, (song_name, song_url))
            
            result = cursor.fetchone()
            song_id = result[0] if result else None
            
            # 添加到缓存
            if song_id:
                self.song_cache[song_name] = song_id
            
            conn.commit()
            return song_id
            
        except Exception as e:
            conn.rollback()
            print(f"保存歌曲出错: {e}")
            return None
        finally:
            cursor.close()
            conn.close()
    
    def save_live_song_relations_batch(self, live_history_id, songs_with_info):
        """批量保存演出歌曲关联关系"""
        if not songs_with_info:
            return
            
        conn = self.get_db_connection()
        cursor = conn.cursor()
        
        try:
            # 准备批量插入数据
            relations_data = []
            for order, song_info in enumerate(songs_with_info, 1):
                song_id = self.song_cache.get(song_info['name'])
                if song_id:
                    relations_data.append((live_history_id, song_id, order, song_info['remark']))
            
            if relations_data:
                insert_sql = """
                    INSERT INTO live_history_song 
                    (live_history_id, live_song_id, song_order, remark) 
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (live_history_id, live_song_id) DO UPDATE SET
                    song_order = EXCLUDED.song_order,
                    remark = EXCLUDED.remark
                """
                cursor.executemany(insert_sql, relations_data)
                conn.commit()
                print(f"  批量保存了 {len(relations_data)} 个歌曲关联关系")
            
        except Exception as e:
            conn.rollback()
            print(f"批量保存关联关系出错: {e}")
        finally:
            cursor.close()
            conn.close()
    
    def run(self):
        """运行爬虫"""
        print("开始运行演出历史爬虫...")
        
        # 获取演出历史列表
        live_history_list = self.get_live_history()
        
        for i, live_data in enumerate(live_history_list):
            print(f"\n处理第 {i+1}/{len(live_history_list)} 场演出: {live_data['performance_name']}")
            
            # 保存演出历史
            live_history_id = self.save_live_history(live_data)
            if not live_history_id:
                print("保存演出历史失败，跳过")
                continue
            
            # 获取歌曲列表
            songs_with_info = self.get_songs_from_detail_page(live_data['url'])
            
            if songs_with_info:
                # 先保存所有新歌曲
                new_songs_count = 0
                for song_info in songs_with_info:
                    if song_info['name'] not in self.song_cache:
                        song_id = self.save_song(song_info['name'], song_info['url'])
                        if song_id:
                            new_songs_count += 1
                
                if new_songs_count > 0:
                    print(f"  新增 {new_songs_count} 首歌曲")
                
                # 批量保存关联关系
                self.save_live_song_relations_batch(live_history_id, songs_with_info)
                
                # 显示歌曲信息
                for song_info in songs_with_info:
                    remark_info = f" (备注: {song_info['remark']})" if song_info['remark'] else ""
                    print(f"  歌曲: {song_info['name']}{remark_info}")
            
            # 减少请求间隔到500ms
            time.sleep(0.5)
        
        print(f"\n爬虫运行完成！共处理了 {len(live_history_list)} 场演出")
        print(f"歌曲缓存中共有 {len(self.song_cache)} 首歌曲")

if __name__ == "__main__":
    analyzer = NanaLiveAnalyzer()
    analyzer.run()

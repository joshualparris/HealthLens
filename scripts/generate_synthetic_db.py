import sqlite3
import os
import zipfile
import time

fixture_dir = os.path.join(os.path.dirname(__file__), '..', 'tests', 'fixtures')
os.makedirs(fixture_dir, exist_ok=True)
db_path = os.path.join(fixture_dir, 'synthetic_health_connect.db')
zip_path = os.path.join(fixture_dir, 'synthetic_export.zip')

if os.path.exists(db_path):
    os.remove(db_path)

db = sqlite3.connect(db_path)
cur = db.cursor()

# Create tables
cur.execute('''CREATE TABLE heart_rate_variability_rmssd_record_table (time INTEGER, heart_rate_variability_millis REAL)''')
cur.execute('''CREATE TABLE heart_rate_record_table (start_time INTEGER, beats_per_minute REAL)''')
cur.execute('''CREATE TABLE sleep_session_record_table (start_time INTEGER, end_time INTEGER, title TEXT)''')
cur.execute('''CREATE TABLE exercise_session_record_table (start_time INTEGER, end_time INTEGER, exercise_type TEXT)''')

# Insert HRV data
# Australian local time crosses UTC boundary (e.g., UTC+10).
# Let's use specific epoch times (in milliseconds).
# Day 1: 1715000000000 (May 6, 2024 12:53 PM UTC) -> May 6 in AU
# Let's just use nice dates in May 2024.
# May 1 to May 28 (28 days) to test 28-day baseline.

base_time = 1714521600000 # May 1, 2024 00:00:00 UTC
for i in range(30):
    if i == 5: continue # Sparse data: skip day 5
    t = base_time + (i * 86400000)
    # Insert multiple samples for some days
    cur.execute(f"INSERT INTO heart_rate_variability_rmssd_record_table VALUES ({t + 1000}, {30.0 + i})")
    cur.execute(f"INSERT INTO heart_rate_variability_rmssd_record_table VALUES ({t + 2000}, {32.0 + i})")
    cur.execute(f"INSERT INTO heart_rate_variability_rmssd_record_table VALUES ({t + 3000}, {35.0 + i})") # Median will be 32.0 + i

# Duplicate records
cur.execute(f"INSERT INTO heart_rate_variability_rmssd_record_table VALUES ({base_time + 86400000 + 1000}, 31.0)")
cur.execute(f"INSERT INTO heart_rate_variability_rmssd_record_table VALUES ({base_time + 86400000 + 1000}, 31.0)") # Duplicate

db.commit()
db.close()

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.write(db_path, 'health_connect_export.db')

print("Created synthetic test fixtures.")

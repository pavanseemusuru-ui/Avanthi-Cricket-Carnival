import sqlite3
from pymongo import MongoClient

SQLITE_DB_PATH = "auction.db"
MONGO_URI = "mongodb://localhost:27017/"
MONGO_DB_NAME = "auction_db"

def export_data():
    print(f"Connecting to SQLite database at {SQLITE_DB_PATH}...")
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()

    print(f"Connecting to MongoDB at {MONGO_URI}...")
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[MONGO_DB_NAME]

    tables = ["players", "franchises", "auction_state", "audit_log"]

    for table in tables:
        try:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            documents = [dict(row) for row in rows]
            
            if documents:
                collection = db[table]
                collection.drop() # Clear previous export
                collection.insert_many(documents)
                print(f"[OK] Exported {len(documents)} records from '{table}' to MongoDB collection '{table}' in database '{MONGO_DB_NAME}'")
            else:
                print(f"[INFO] Table '{table}' is empty, skipped.")
        except Exception as e:
            print(f"[ERROR] Exporting table '{table}': {e}")

    sqlite_conn.close()
    mongo_client.close()
    print("\nExport to MongoDB completed successfully!")

if __name__ == "__main__":
    export_data()

#!/usr/bin/env python3

import sqlite3
import json
import uuid
from datetime import datetime

def seed_games():
    # Connect to SQLite database
    conn = sqlite3.connect('backend/test.db')
    cursor = conn.cursor()

    # Create games
    games = [
        {
            'id': str(uuid.uuid4()),
            'code': 'NBACK',
            'title': 'N-Back Memory Test',
            'description': 'Test working memory by identifying when current item matches N positions back',
            'base_config': json.dumps({
                'n': 2,
                'trials': 20,
                'stimulus_duration': 500,
                'inter_stimulus_interval': 1500
            })
        },
        {
            'id': str(uuid.uuid4()),
            'code': 'STROOP',
            'title': 'Stroop Test',
            'description': 'Test cognitive interference by naming colors of conflicting words',
            'base_config': json.dumps({
                'trials': 50,
                'colors': ['red', 'blue', 'green', 'yellow'],
                'timer': 180
            })
        },
        {
            'id': str(uuid.uuid4()),
            'code': 'REACTION_TIME',
            'title': 'Reaction Time Test',
            'description': 'Test processing speed and reaction time',
            'base_config': json.dumps({
                'trials': 30,
                'min_delay': 500,
                'max_delay': 2000
            })
        }
    ]

    # Insert games
    for game in games:
        cursor.execute('''
            INSERT OR REPLACE INTO games (id, code, title, description, base_config)
            VALUES (?, ?, ?, ?, ?)
        ''', (game['id'], game['code'], game['title'], game['description'], game['base_config']))

    conn.commit()
    conn.close()

    print("✅ Games seeded successfully!")
    for game in games:
        print(f"   - {game['code']}: {game['title']}")

if __name__ == '__main__':
    seed_games()
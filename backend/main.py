import os
import click
from flask_migrate import Migrate
from sqlalchemy import text
from app import create_app, db, huey
from app.models.manga import File, Tag, TagType, TagAlias, FileTagMap, Bookmark, Like, Task

# Ensure the instance folder exists
instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance')
os.makedirs(instance_path, exist_ok=True)

app = create_app(os.getenv('FLASK_CONFIG') or 'default')
migrate = Migrate(app, db)

# The models need to be imported before db.create_all() is called,
# and flask db upgrade also needs them.
with app.app_context():
    db.create_all()
    # Lightweight schema guard: ensure new optional columns exist (SQLite only).
    try:
        def _table_has_column(table_name, col_name):
            result = db.session.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
            return any(row[1] == col_name for row in result)

        def _ensure_column(table_name, column_name, column_definition):
            if not _table_has_column(table_name, column_name):
                db.session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_definition}"))
                return True
            return False

        added_columns = []
        if _ensure_column('tags', 'color', 'color TEXT'):
            added_columns.append('tags.color')
        if _ensure_column('tags', 'is_favorite', 'is_favorite BOOLEAN NOT NULL DEFAULT 0'):
            added_columns.append('tags.is_favorite')

        db.session.commit()

        if added_columns:
            app.logger.info("Auto-added missing columns: %s", ", ".join(added_columns))
    except Exception as exc:
        db.session.rollback()
        app.logger.warning("Automatic schema guard failed: %s", exc)
        # Do not hard-fail app startup on migration guard; migrations can be applied via Flask-Migrate if preferred.

@app.shell_context_processor
def make_shell_context():
    return dict(db=db, File=File, Tag=Tag, TagType=TagType, TagAlias=TagAlias, 
                FileTagMap=FileTagMap, Bookmark=Bookmark, Like=Like, Task=Task)

@app.cli.command()
@click.argument('test_names', nargs=-1)
def test(test_names):
    """Run the unit tests."""
    import unittest
    if test_names:
        tests = unittest.TestLoader().loadTestsFromNames(test_names)
    else:
        tests = unittest.TestLoader().discover('tests')
    unittest.TextTestRunner(verbosity=2).run(tests)

if __name__ == '__main__':
    app.run(debug=True) 

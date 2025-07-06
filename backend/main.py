import os
import click
from flask_migrate import Migrate
from app import create_app, db, huey
from app.models.manga import File, Tag, TagType, TagAlias, FileTagMap, Bookmark, Wishlist, Task

# Ensure the instance folder exists
instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance')
os.makedirs(instance_path, exist_ok=True)

app = create_app(os.getenv('FLASK_CONFIG') or 'default')
migrate = Migrate(app, db)

# The models need to be imported before db.create_all() is called,
# and flask db upgrade also needs them.
with app.app_context():
    db.create_all()

@app.shell_context_processor
def make_shell_context():
    return dict(db=db, File=File, Tag=Tag, TagType=TagType, TagAlias=TagAlias, 
                FileTagMap=FileTagMap, Bookmark=Bookmark, Wishlist=Wishlist, Task=Task)

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
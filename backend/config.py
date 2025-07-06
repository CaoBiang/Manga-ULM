import os
from dotenv import load_dotenv

# Define the base directory of the application
basedir = os.path.abspath(os.path.dirname(__file__))
# This will point to the `backend` directory. We need the root.
project_root = os.path.dirname(basedir)
INSTANCE_PATH = os.path.join(project_root, 'instance')

load_dotenv(os.path.join(basedir, '.env'))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-hard-to-guess-string'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    HUEY = {
        'huey_class': 'huey.SqliteHuey',
        'filename': os.path.join(INSTANCE_PATH, 'huey.db'),
    }
    # Path for storing generated cover thumbnails
    COVER_CACHE_PATH = os.path.join(INSTANCE_PATH, 'covers')
    # Path for storing database backups
    BACKUP_PATH = os.path.join(INSTANCE_PATH, 'backups')
    
    @staticmethod
    def init_app(app):
        # Create the cover cache directory if it doesn't exist
        os.makedirs(app.config['COVER_CACHE_PATH'], exist_ok=True)


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or \
        'sqlite:///' + os.path.join(INSTANCE_PATH, 'manga_manager_dev.db')

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('TEST_DATABASE_URL') or \
        'sqlite://' # In-memory database
    WTF_CSRF_ENABLED = False

class ProductionConfig(Config):
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(INSTANCE_PATH, 'manga_manager.db')

config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
} 
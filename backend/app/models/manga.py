from .. import db
import datetime

class FileTagMap(db.Model):
    __tablename__ = 'file_tag_map'
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tags.id'), primary_key=True)

class File(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.Text, nullable=False, unique=True, index=True)
    file_hash = db.Column(db.Text, nullable=False, unique=True, index=True)
    file_size = db.Column(db.Integer)
    add_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    total_pages = db.Column(db.Integer)
    spread_pages = db.Column(db.Text, default='[]')  # JSON array as a string
    last_read_page = db.Column(db.Integer, default=0)
    last_read_date = db.Column(db.DateTime)
    reading_status = db.Column(db.Text, index=True, default='unread')  # 'unread', 'in_progress', 'finished'
    is_missing = db.Column(db.Boolean, nullable=False, default=False, index=True)
    integrity_status = db.Column(db.Text, default='unknown')  # 'unknown', 'ok', 'corrupted'
    
    tags = db.relationship('Tag', secondary='file_tag_map', back_populates='files')
    bookmarks = db.relationship('Bookmark', backref='file', lazy='dynamic')
    wishlist_item = db.relationship('Wishlist', backref='file', uselist=False)

class Tag(db.Model):
    __tablename__ = 'tags'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False, unique=True)
    type_id = db.Column(db.Integer, db.ForeignKey('tag_types.id'))
    parent_id = db.Column(db.Integer, db.ForeignKey('tags.id'), nullable=True)
    description = db.Column(db.Text)

    files = db.relationship('File', secondary='file_tag_map', back_populates='tags')
    aliases = db.relationship('TagAlias', backref='tag', lazy='dynamic')
    parent = db.relationship('Tag', remote_side=[id], backref='children')

class TagAlias(db.Model):
    __tablename__ = 'tag_aliases'
    id = db.Column(db.Integer, primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tags.id'), nullable=False, index=True)
    alias_name = db.Column(db.Text, nullable=False, unique=True, index=True)

class TagType(db.Model):
    __tablename__ = 'tag_types'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False, unique=True)
    sort_order = db.Column(db.Integer)
    tags = db.relationship('Tag', backref='type', lazy='dynamic')

class Bookmark(db.Model):
    __tablename__ = 'bookmarks'
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)
    note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Wishlist(db.Model):
    __tablename__ = 'wishlist'
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False, unique=True)
    added_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text)
    status = db.Column(db.Text)
    progress = db.Column(db.Float)
    log = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    finished_at = db.Column(db.DateTime)

class Config(db.Model):
    __tablename__ = 'config'
    key = db.Column(db.Text, primary_key=True)
    value = db.Column(db.Text) 
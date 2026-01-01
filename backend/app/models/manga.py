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
    like_item = db.relationship('Like', backref='file', uselist=False)

class Tag(db.Model):
    __tablename__ = 'tags'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False, unique=True)
    type_id = db.Column(db.Integer, db.ForeignKey('tag_types.id'))
    parent_id = db.Column(db.Integer, db.ForeignKey('tags.id'), nullable=True)
    description = db.Column(db.Text)
    # Optional visual and UX enhancements
    color = db.Column(db.Text)  # e.g., '#FF0000' or preset names like 'red'
    is_favorite = db.Column(db.Boolean, nullable=False, default=False, index=True)

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

class Like(db.Model):
    __tablename__ = 'likes'
    id = db.Column(db.Integer, primary_key=True)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False, unique=True)
    added_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text)
    task_type = db.Column(db.Text, nullable=False, index=True)  # 'scan', 'rename', 'backup', etc.
    task_id = db.Column(db.Text, unique=True, index=True)  # Huey task ID
    status = db.Column(db.Text, nullable=False, default='pending', index=True)  # 'pending', 'running', 'completed', 'failed'
    progress = db.Column(db.Float, default=0.0)  # 0-100
    current_file = db.Column(db.Text)  # 当前正在处理的文件
    target_path = db.Column(db.Text)  # 扫描目标路径
    total_files = db.Column(db.Integer, default=0)  # 总文件数
    processed_files = db.Column(db.Integer, default=0)  # 已处理文件数
    error_message = db.Column(db.Text)  # 错误信息
    log = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    started_at = db.Column(db.DateTime)  # 实际开始时间
    finished_at = db.Column(db.DateTime)
    
    @property
    def is_active(self):
        """检查任务是否仍在活跃状态"""
        return self.status in ['pending', 'running']
    
    @property
    def duration(self):
        """计算任务执行时长"""
        if self.started_at:
            end_time = self.finished_at or datetime.datetime.utcnow()
            return (end_time - self.started_at).total_seconds()
        return 0
    
    def to_dict(self):
        """转换为字典格式，便于API返回"""
        return {
            'id': self.id,
            'name': self.name,
            'task_type': self.task_type,
            'task_id': self.task_id,
            'status': self.status,
            'progress': self.progress,
            'current_file': self.current_file,
            'target_path': self.target_path,
            'total_files': self.total_files,
            'processed_files': self.processed_files,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'finished_at': self.finished_at.isoformat() if self.finished_at else None,
            'duration': self.duration,
            'is_active': self.is_active
        }

class Config(db.Model):
    __tablename__ = 'config'
    key = db.Column(db.Text, primary_key=True)
    value = db.Column(db.Text)

class LibraryPath(db.Model):
    __tablename__ = 'library_paths'
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.Text, nullable=False, unique=True) 

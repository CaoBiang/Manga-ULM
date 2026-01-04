import os
import click
from flask_migrate import Migrate
from sqlalchemy import text
from app import create_app, db, huey
from config import INSTANCE_PATH
from app.models.manga import File, Tag, TagType, TagAlias, FileTagMap, Bookmark, Like, Task

# 确保 instance 目录存在
os.makedirs(INSTANCE_PATH, exist_ok=True)

app = create_app(os.getenv('FLASK_CONFIG') or 'default')
migrate = Migrate(app, db)

# 说明：
# - 当前项目处于快速重构阶段，不考虑旧数据库的前向兼容。
# - 当数据模型发生破坏性变更时，直接重置本地 SQLite 数据库以保证可用性与一致性。
DB_SCHEMA_VERSION = 3


def _is_sqlite_database() -> bool:
    uri = str(app.config.get('SQLALCHEMY_DATABASE_URI') or '')
    return uri.startswith('sqlite')


def _reset_sqlite_database(expected_version: int) -> None:
    """
    彻底重置 SQLite 数据库：删除所有表并重新创建。
    注意：这是破坏性操作，仅适用于“无需前向兼容”的开发阶段。
    """
    db.session.execute(text('PRAGMA foreign_keys=OFF'))

    tables = db.session.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    ).fetchall()
    for (table_name,) in tables:
        db.session.execute(text(f'DROP TABLE IF EXISTS \"{table_name}\"'))

    db.session.execute(text(f'PRAGMA user_version = {int(expected_version)}'))
    db.session.commit()
    db.create_all()

with app.app_context():
    if _is_sqlite_database():
        current_version = db.session.execute(text('PRAGMA user_version')).scalar() or 0
        if int(current_version) != int(DB_SCHEMA_VERSION):
            app.logger.warning(
                '检测到数据库结构版本不匹配（当前=%s 期望=%s），将重置本地数据库（不保留旧数据）。',
                current_version,
                DB_SCHEMA_VERSION,
            )
            _reset_sqlite_database(DB_SCHEMA_VERSION)
    else:
        db.create_all()

@app.shell_context_processor
def make_shell_context():
    return dict(db=db, File=File, Tag=Tag, TagType=TagType, TagAlias=TagAlias, 
                FileTagMap=FileTagMap, Bookmark=Bookmark, Like=Like, Task=Task)

@app.cli.command()
@click.argument('test_names', nargs=-1)
def test(test_names):
    """运行单元测试。"""
    import unittest
    if test_names:
        tests = unittest.TestLoader().loadTestsFromNames(test_names)
    else:
        tests = unittest.TestLoader().discover('tests')
    unittest.TextTestRunner(verbosity=2).run(tests)

if __name__ == '__main__':
    app.run(debug=True) 

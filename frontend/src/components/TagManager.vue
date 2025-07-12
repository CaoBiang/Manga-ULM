<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import io from 'socket.io-client';

const { t } = useI18n();
const socket = io({ transports: ['websocket'] });

const props = defineProps({
  types: {
    type: Array,
    required: true,
  },
});

const tags = ref([]);
const filteredTags = ref([]);
const selectedTypeId = ref(null);
const isLoading = ref(false);
const showModal = ref(false);
const editingTag = ref(null);
const showFileChangeModal = ref(false);
const fileChangeTag = ref(null);
const fileChangeAction = ref('delete'); // 'delete' or 'rename'
const newTagName = ref('');
const fileChangeProgress = ref(null);
const isProcessingFileChange = ref(false);

// 拆分标签相关状态
const showSplitModal = ref(false);
const splitTag = ref(null);
const newTagNames = ref([]);
const newTagNameInput = ref('');
const splitProgress = ref(null);
const isProcessingSplit = ref(false);

const tagForm = ref({
  id: null,
  name: '',
  description: '',
  type_id: null,
  parent_id: null,
  aliases: [],
  newAlias: ''
});

const fetchTags = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/api/v1/tags');
    tags.value = response.data;
    // Initially, show all tags
    if (selectedTypeId.value === null && props.types.length > 0) {
      selectedTypeId.value = 'all';
    }
    filterTags();
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    alert(t('errorFetchingTags'));
  } finally {
    isLoading.value = false;
  }
};

const filterTags = () => {
    if (selectedTypeId.value === 'all') {
        filteredTags.value = tags.value;
    } else {
        filteredTags.value = tags.value.filter(t => t.type_id === selectedTypeId.value);
    }
};

watch(selectedTypeId, filterTags);

onMounted(() => {
  fetchTags();
  
  // 添加Socket.IO连接调试
  socket.on('connect', () => {
    console.log('Socket.IO connected successfully');
  });
  
  socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
  });
});

const getTypeName = (typeId) => {
  const type = props.types.find(t => t.id === typeId);
  return type ? type.name : t('none');
};

const getParentName = (parentId) => {
    if (!parentId) return t('none');
    const parent = tags.value.find(t => t.id === parentId);
    return parent ? parent.name : t('none');
}

const openCreateModal = () => {
  editingTag.value = null;
  tagForm.value = {
    id: null,
    name: '',
    description: '',
    type_id: selectedTypeId.value !== 'all' ? selectedTypeId.value : (props.types.length > 0 ? props.types[0].id : null),
    parent_id: null,
    aliases: [],
    newAlias: ''
  };
  showModal.value = true;
};

const openEditModal = (tag) => {
  editingTag.value = { ...tag };
  tagForm.value = {
    id: tag.id,
    name: tag.name,
    description: tag.description || '',
    type_id: tag.type_id,
    parent_id: tag.parent_id,
    aliases: [...tag.aliases],
    newAlias: ''
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingTag.value = null;
};

const addAlias = () => {
  if (tagForm.value.newAlias && !tagForm.value.aliases.includes(tagForm.value.newAlias)) {
    tagForm.value.aliases.push(tagForm.value.newAlias);
    tagForm.value.newAlias = '';
  }
};

const removeAlias = (aliasToRemove) => {
  tagForm.value.aliases = tagForm.value.aliases.filter(alias => alias !== aliasToRemove);
};

const saveTag = async () => {
  if (!tagForm.value.name || !tagForm.value.type_id) {
    alert(t('tagNameAndTypeRequired'));
    return;
  }

  const payload = {
    name: tagForm.value.name,
    description: tagForm.value.description,
    type_id: tagForm.value.type_id,
    parent_id: tagForm.value.parent_id,
    aliases: tagForm.value.aliases,
  };

  try {
    if (editingTag.value) {
      // Update existing tag
      await axios.put(`/api/v1/tags/${editingTag.value.id}`, payload);
    } else {
      // Create new tag
      await axios.post('/api/v1/tags', payload);
    }
    closeModal();
    fetchTags(); // Refresh tag list
  } catch (error) {
    console.error('Failed to save tag:', error);
    alert(t('errorSavingTag') + (error.response?.data?.error || ''));
  }
};

const deleteTag = async (id) => {
    if (!confirm(t('confirmDeleteTag'))) return;
    try {
        await axios.delete(`/api/v1/tags/${id}`);
        fetchTags(); // Refresh tag list
    } catch (error) {
        console.error('Failed to delete tag:', error);
        alert(t('errorDeletingTag') + (error.response?.data?.error || ''));
    }
}

const availableParents = computed(() => {
    return tags.value.filter(tag => tag.id !== editingTag.value?.id);
});

// 文件变更相关方法
const openFileChangeModal = (tag) => {
  fileChangeTag.value = { ...tag };
  fileChangeAction.value = 'delete';
  newTagName.value = '';
  fileChangeProgress.value = null;
  isProcessingFileChange.value = false;
  showFileChangeModal.value = true;
};

const closeFileChangeModal = () => {
  showFileChangeModal.value = false;
  fileChangeTag.value = null;
  fileChangeProgress.value = null;
  isProcessingFileChange.value = false;
};

const executeFileChange = async () => {
  if (!fileChangeTag.value) return;
  
  if (fileChangeAction.value === 'rename' && !newTagName.value.trim()) {
    alert('请输入新的标签名称');
    return;
  }
  
  let confirmMessage = '';
  if (fileChangeAction.value === 'delete') {
    confirmMessage = `确定要执行以下操作吗？\n\n` +
      `1. 从所有文件名中删除标签 [${fileChangeTag.value.name}]\n` +
      `2. 从系统中完全删除此标签\n` +
      `3. 清理所有相关的标签索引\n\n` +
      `此操作不可撤销！`;
  } else {
    confirmMessage = `确定要执行以下操作吗？\n\n` +
      `1. 将所有文件名中的 [${fileChangeTag.value.name}] 重命名为 [${newTagName.value}]\n` +
      `2. 更新标签系统中的标签名称\n` +
      `3. 同步所有相关的标签索引\n\n` +
      `注意：如果目标标签已存在，将自动合并到现有标签。`;
  }
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  isProcessingFileChange.value = true;
  fileChangeProgress.value = {
    progress: 0,
    current_file: '准备开始...',
    total_files: 0,
    processed: 0
  };
  
  try {
    const payload = {
      action: fileChangeAction.value,
      new_name: fileChangeAction.value === 'rename' ? newTagName.value.trim() : undefined
    };
    
    console.log('Sending file change request:', payload);
    const response = await axios.post(`/api/v1/tags/${fileChangeTag.value.id}/file-change`, payload);
    console.log('File change response:', response.data);
    
    // 监听Socket.IO事件
    setupFileChangeSocketListeners();
    
    // 开始任务成功，显示初始进度
    console.log('Task started successfully with ID:', response.data.task_id);
    
    // 更新进度显示为等待状态
    fileChangeProgress.value = {
      progress: 0,
      current_file: '任务已启动，等待开始处理...',
      total_files: 0,
      processed: 0
    };
    
  } catch (error) {
    console.error('Failed to start file change:', error);
    alert('启动文件变更失败: ' + (error.response?.data?.error || error.message));
    isProcessingFileChange.value = false;
    fileChangeProgress.value = null;
  }
};

const setupFileChangeSocketListeners = () => {
  console.log('Setting up file change socket listeners');
  
  // 清理之前的监听器
  socket.off('tag_change_progress');
  socket.off('tag_change_complete');
  socket.off('tag_change_error');
  socket.off('tag_change_info');
  
  // 监听标签变更进度
  socket.on('tag_change_progress', (data) => {
    console.log('Received tag_change_progress:', data);
    fileChangeProgress.value = {
      progress: data.progress || 0,
      current_file: data.current_file || '处理中...',
      total_files: data.total_files || 0,
      processed: data.processed || 0
    };
  });

  // 监听标签变更完成
  socket.on('tag_change_complete', (data) => {
    console.log('Received tag_change_complete:', data);
    fileChangeProgress.value = {
      progress: 100,
      current_file: '完成',
      total_files: fileChangeProgress.value?.total_files || 0,
      processed: fileChangeProgress.value?.total_files || 0
    };
    isProcessingFileChange.value = false;
    
    // 根据操作类型显示不同的完成消息
    let completionMessage = data.message || '文件变更完成';
    if (fileChangeAction.value === 'delete') {
      completionMessage += '\n标签已从系统中删除。';
    } else if (fileChangeAction.value === 'rename') {
      completionMessage += `\n标签已重命名为"${newTagName.value}"。`;
    }
    
    alert(completionMessage);
    fetchTags(); // 刷新标签列表以反映最新状态
    
    // 移除监听器
    cleanupFileChangeListeners();
  });

  // 监听标签变更错误
  socket.on('tag_change_error', (data) => {
    console.error('Tag change error:', data.error);
    alert('文件变更错误: ' + data.error);
    // 不要在这里停止处理，让任务继续
  });

  // 监听标签变更信息
  socket.on('tag_change_info', (data) => {
    console.log('Tag change info:', data.message);
  });
  
  // 设置超时处理（30秒后如果没有进度更新，显示警告）
  const timeoutId = setTimeout(() => {
    if (isProcessingFileChange.value) {
      console.warn('File change task seems to be stuck, no progress received');
      // 不自动停止，只是警告
    }
  }, 30000);
  
  // 保存超时ID以便清理
  socket._fileChangeTimeoutId = timeoutId;
};

const cleanupFileChangeListeners = () => {
  console.log('Cleaning up file change socket listeners');
  socket.off('tag_change_progress');
  socket.off('tag_change_complete');
  socket.off('tag_change_error');
  socket.off('tag_change_info');
  
  if (socket._fileChangeTimeoutId) {
    clearTimeout(socket._fileChangeTimeoutId);
    delete socket._fileChangeTimeoutId;
  }
};

const runInBackground = () => {
  console.log('Running file change task in background');
  closeFileChangeModal();
  // 任务将继续在后台运行，通过Socket.IO接收更新
};

// 拆分标签相关方法
const openSplitModal = (tag) => {
  splitTag.value = { ...tag };
  newTagNames.value = [];
  newTagNameInput.value = '';
  splitProgress.value = null;
  isProcessingSplit.value = false;
  showSplitModal.value = true;
};

const closeSplitModal = () => {
  showSplitModal.value = false;
  splitTag.value = null;
  newTagNames.value = [];
  newTagNameInput.value = '';
  splitProgress.value = null;
  isProcessingSplit.value = false;
};

const addNewTagName = () => {
  const trimmedName = newTagNameInput.value.trim();
  if (trimmedName && !newTagNames.value.includes(trimmedName)) {
    newTagNames.value.push(trimmedName);
    newTagNameInput.value = '';
  }
};

const removeNewTagName = (tagName) => {
  newTagNames.value = newTagNames.value.filter(name => name !== tagName);
};

const executeSplit = async () => {
  if (!splitTag.value || newTagNames.value.length === 0) {
    alert('请至少添加一个新标签名称');
    return;
  }

  const confirmMessage = `确定要将标签 [${splitTag.value.name}] 拆分为以下标签吗？\n\n` +
    newTagNames.value.map(name => `• [${name}]`).join('\n') + '\n\n' +
    `此操作将：\n` +
    `1. 创建上述新标签\n` +
    `2. 将所有包含 [${splitTag.value.name}] 的文件重命名\n` +
    `3. 移除原标签并更新文件的标签关联\n\n` +
    `此操作不可撤销！`;

  if (!confirm(confirmMessage)) {
    return;
  }

  isProcessingSplit.value = true;
  splitProgress.value = {
    progress: 0,
    current_step: '准备开始拆分...',
    total_steps: 0
  };

  try {
    const payload = {
      new_tag_names: newTagNames.value
    };

    console.log('Sending split request:', payload);
    const response = await axios.post(`/api/v1/tags/${splitTag.value.id}/split`, payload);
    console.log('Split response:', response.data);

    // 监听Socket.IO事件
    setupSplitSocketListeners();

    // 开始任务成功，显示初始进度
    console.log('Split task started successfully with ID:', response.data.task_id);

    // 更新进度显示为等待状态
    splitProgress.value = {
      progress: 0,
      current_step: '拆分任务已启动，等待开始处理...',
      total_steps: 0
    };

  } catch (error) {
    console.error('Failed to start split:', error);
    alert('启动标签拆分失败: ' + (error.response?.data?.error || error.message));
    isProcessingSplit.value = false;
    splitProgress.value = null;
  }
};

const setupSplitSocketListeners = () => {
  console.log('Setting up split socket listeners');

  // 清理之前的监听器
  socket.off('tag_split_progress');
  socket.off('tag_split_complete');
  socket.off('tag_split_error');

  // 进度更新
  socket.on('tag_split_progress', (data) => {
    console.log('Received split progress:', data);
    splitProgress.value = {
      progress: data.progress || 0,
      current_step: data.current_step || '',
      total_steps: data.total_steps || 0
    };
  });

  // 完成
  socket.on('tag_split_complete', (data) => {
    console.log('Split completed:', data);
    alert('拆分完成：' + data.message);
    
    // 关闭模态框并刷新数据
    closeSplitModal();
    fetchTags();
  });

  // 错误
  socket.on('tag_split_error', (data) => {
    console.error('Split error:', data);
    alert('拆分失败：' + data.error);
    isProcessingSplit.value = false;
    splitProgress.value = null;
  });
};

const runSplitInBackground = () => {
  closeSplitModal();
  alert('拆分任务已在后台运行，您可以在任务管理中查看进度。');
};

const testSocketConnection = () => {
  console.log('Testing Socket.IO connection...');
  console.log('Socket connected:', socket.connected);
  console.log('Socket ID:', socket.id);
  
  if (!socket.connected) {
    alert('Socket.IO连接未建立！请检查网络连接。');
  } else {
    alert('Socket.IO连接正常！');
    
    // 测试事件监听
    socket.emit('test_event', {message: 'test from frontend'});
    
    // 监听测试事件
    socket.once('test_response', (data) => {
      console.log('Received test response:', data);
      alert('Socket.IO双向通信测试成功！');
    });
  }
};

</script>

<template>
  <div class="p-4 bg-white rounded-lg shadow-md">
    <h3 class="text-xl font-semibold mb-4">{{ $t('tagManagement') }}</h3>

    <!-- Filter and Actions -->
    <div class="flex justify-between items-center mb-4">
  <div>
        <label for="type-filter" class="mr-2 font-medium">{{ $t('filterByType') }}</label>
        <select id="type-filter" v-model="selectedTypeId" class="p-2 border rounded-md">
          <option value="all">{{ $t('allTypes') }}</option>
          <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
        </select>
      </div>
      <div class="flex space-x-2">
        <button @click="testSocketConnection" class="btn btn-secondary btn-sm">测试连接</button>
        <button @click="openCreateModal" class="btn btn-primary">
          + {{ $t('newTag') }}
        </button>
      </div>
    </div>

    <!-- Tags Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left py-2 px-4">{{ $t('name') }}</th>
            <th class="text-left py-2 px-4">{{ $t('description') }}</th>
            <th class="text-left py-2 px-4">{{ $t('type') }}</th>
            <th class="text-left py-2 px-4">{{ $t('parentTag') }}</th>
            <th class="text-left py-2 px-4">{{ $t('aliases') }}</th>
            <th class="text-left py-2 px-4">{{ $t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="6" class="text-center py-4">{{ $t('loading') }}...</td>
          </tr>
          <tr v-for="tag in filteredTags" :key="tag.id" class="border-b hover:bg-gray-50">
            <td class="py-2 px-4 font-medium">{{ tag.name }}</td>
            <td class="py-2 px-4 text-sm text-gray-600 max-w-xs truncate">{{ tag.description || '-' }}</td>
            <td class="py-2 px-4">{{ getTypeName(tag.type_id) }}</td>
            <td class="py-2 px-4">{{ getParentName(tag.parent_id) }}</td>
            <td class="py-2 px-4">
                <span v-if="tag.aliases.length" class="text-sm text-gray-500">{{ tag.aliases.join(', ') }}</span>
                <span v-else class="text-sm text-gray-400">-</span>
            </td>
            <td class="py-2 px-4">
              <div class="flex space-x-2">
                <button @click="openEditModal(tag)" class="btn btn-secondary btn-sm">{{ $t('edit') }}</button>
                <button @click="openFileChangeModal(tag)" class="btn btn-warning btn-sm">文件变更</button>
                <button @click="openSplitModal(tag)" class="btn btn-info btn-sm">拆分标签</button>
                <button @click="deleteTag(tag.id)" class="btn btn-danger btn-sm">{{ $t('delete') }}</button>
              </div>
            </td>
          </tr>
           <tr v-if="!isLoading && filteredTags.length === 0">
            <td colspan="6" class="text-center py-4 text-gray-500">{{ $t('noTagsFoundForType') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-full overflow-y-auto">
        <h4 class="text-xl font-semibold mb-4">{{ editingTag ? $t('edit') + ' ' + $t('tag') : $t('newTag') }}</h4>
        
        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium">{{ $t('name') }}*</label>
            <input v-model="tagForm.name" type="text" class="w-full p-2 border rounded-md" />
          </div>
          <div>
            <label class="block text-sm font-medium">{{ $t('description') }}</label>
            <textarea v-model="tagForm.description" class="w-full p-2 border rounded-md"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium">{{ $t('type') }}*</label>
            <select v-model="tagForm.type_id" class="w-full p-2 border rounded-md">
              <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium">{{ $t('parentTag') }}</label>
            <select v-model="tagForm.parent_id" class="w-full p-2 border rounded-md">
              <option :value="null">{{ t('none') }}</option>
              <option v-for="parent in availableParents" :key="parent.id" :value="parent.id">
                {{ parent.name }} ({{ getTypeName(parent.type_id) }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium">{{ $t('aliases') }}</label>
            <div class="flex space-x-2">
              <input v-model="tagForm.newAlias" @keyup.enter="addAlias" type="text" :placeholder="t('addAliasPlaceholder')" class="w-full p-2 border rounded-md" />
            </div>
            <div class="mt-2 flex flex-wrap gap-2">
              <span v-for="alias in tagForm.aliases" :key="alias" class="bg-gray-200 text-sm rounded-full px-3 py-1 flex items-center">
                {{ alias }}
                <button @click="removeAlias(alias)" class="ml-2 text-red-500">&times;</button>
              </span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex justify-end space-x-2">
          <button @click="closeModal" class="btn btn-secondary">{{ $t('cancel') }}</button>
          <button @click="saveTag" class="btn btn-primary">{{ $t('save') }}</button>
        </div>
      </div>
    </div>

    <!-- 文件变更模态框 -->
    <div v-if="showFileChangeModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h4 class="text-xl font-semibold mb-4">文件变更 - {{ fileChangeTag?.name }}</h4>
        
        <div v-if="!isProcessingFileChange" class="space-y-4">
          <!-- 操作选择 -->
          <div>
            <label class="block text-sm font-medium mb-2">选择操作</label>
            <div class="space-y-2">
              <label class="flex items-center">
                <input v-model="fileChangeAction" type="radio" value="delete" class="mr-2">
                删除标签 - 从所有文件名中删除 [{{ fileChangeTag?.name }}]
              </label>
              <label class="flex items-center">
                <input v-model="fileChangeAction" type="radio" value="rename" class="mr-2">
                重命名标签 - 将所有文件名中的 [{{ fileChangeTag?.name }}] 替换为新名称
              </label>
            </div>
          </div>

          <!-- 新标签名称（只在重命名时显示） -->
          <div v-if="fileChangeAction === 'rename'">
            <label class="block text-sm font-medium mb-2">新标签名称</label>
            <input v-model="newTagName" type="text" :placeholder="fileChangeTag?.name" 
                   class="w-full p-2 border rounded-md">
          </div>

          <!-- 操作说明 -->
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p class="text-sm text-yellow-800">
              <strong>注意：</strong>此操作将修改文件系统中的实际文件名，请确保已备份重要数据。
            </p>
          </div>

          <!-- 按钮 -->
          <div class="flex justify-end space-x-2 mt-6">
            <button @click="closeFileChangeModal" class="btn btn-secondary">取消</button>
            <button @click="executeFileChange" class="btn btn-primary">确认执行</button>
          </div>
        </div>

        <!-- 进度显示 -->
        <div v-if="isProcessingFileChange && fileChangeProgress" class="space-y-4">
          <div class="text-center">
            <p class="text-lg font-medium">正在处理文件变更...</p>
            <p class="text-sm text-gray-600 mt-2">{{ fileChangeProgress.current_file }}</p>
          </div>
          
          <!-- 进度条 -->
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                 :style="{ width: fileChangeProgress.progress + '%' }"></div>
          </div>
          
          <div class="text-center text-sm text-gray-600">
            {{ fileChangeProgress.processed || 0 }} / {{ fileChangeProgress.total_files || 0 }} 文件
            ({{ Math.round(fileChangeProgress.progress || 0) }}%)
          </div>
          
          <div class="flex justify-center">
            <button @click="runInBackground" class="btn btn-secondary">
              后台运行
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 拆分标签模态框 -->
    <div v-if="showSplitModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h4 class="text-xl font-semibold mb-4">拆分标签 - {{ splitTag?.name }}</h4>
        
        <div v-if="!isProcessingSplit" class="space-y-4">
          <!-- 当前标签信息 -->
          <div class="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p class="text-sm text-gray-700">
              <strong>当前标签：</strong>{{ splitTag?.name }}
            </p>
            <p class="text-sm text-gray-600 mt-1">
              <strong>类型：</strong>{{ getTypeName(splitTag?.type_id) }}
            </p>
          </div>

          <!-- 新标签名称输入 -->
          <div>
            <label class="block text-sm font-medium mb-2">新标签名称</label>
            <div class="flex space-x-2">
              <input v-model="newTagNameInput" @keyup.enter="addNewTagName" type="text" 
                     placeholder="输入新标签名称" class="flex-1 p-2 border rounded-md">
              <button @click="addNewTagName" class="btn btn-primary">添加</button>
            </div>
          </div>

          <!-- 新标签列表 -->
          <div v-if="newTagNames.length > 0">
            <label class="block text-sm font-medium mb-2">拆分后的标签 ({{ newTagNames.length }})</label>
            <div class="space-y-2 max-h-32 overflow-y-auto">
              <div v-for="tagName in newTagNames" :key="tagName" 
                   class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md p-2">
                <span class="text-sm font-medium text-blue-800">[{{ tagName }}]</span>
                <button @click="removeNewTagName(tagName)" class="text-red-500 hover:text-red-700">
                  &times;
                </button>
              </div>
            </div>
          </div>

          <!-- 操作说明 -->
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p class="text-sm text-yellow-800">
              <strong>注意：</strong>此操作将：
            </p>
            <ul class="text-sm text-yellow-700 mt-1 list-disc list-inside">
              <li>创建新的标签记录</li>
              <li>重命名所有包含原标签的文件</li>
              <li>删除原标签</li>
              <li>此操作不可撤销</li>
            </ul>
          </div>

          <!-- 按钮 -->
          <div class="flex justify-end space-x-2 mt-6">
            <button @click="closeSplitModal" class="btn btn-secondary">取消</button>
            <button @click="executeSplit" :disabled="newTagNames.length === 0" 
                    class="btn btn-primary">确认拆分</button>
          </div>
        </div>

        <!-- 进度显示 -->
        <div v-if="isProcessingSplit && splitProgress" class="space-y-4">
          <div class="text-center">
            <p class="text-lg font-medium">正在拆分标签...</p>
            <p class="text-sm text-gray-600 mt-2">{{ splitProgress.current_step }}</p>
          </div>
          
          <!-- 进度条 -->
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-green-600 h-2 rounded-full transition-all duration-300" 
                 :style="{ width: splitProgress.progress + '%' }"></div>
          </div>
          
          <div class="text-center text-sm text-gray-600">
            {{ Math.round(splitProgress.progress || 0) }}%
            <span v-if="splitProgress.total_steps > 0">
              (第 {{ Math.ceil((splitProgress.progress || 0) / 100 * splitProgress.total_steps) }} 步 / 共 {{ splitProgress.total_steps }} 步)
            </span>
          </div>
          
          <div class="flex justify-center">
            <button @click="runSplitInBackground" class="btn btn-secondary">
              后台运行
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template> 

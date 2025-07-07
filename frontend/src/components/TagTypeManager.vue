<script setup>
import { ref } from 'vue';
import axios from 'axios';

const props = defineProps({
  types: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['dataChanged']);

const newTypeName = ref('');
const newTypeSortOrder = ref(0);
const isCreating = ref(false);
const editingTypeId = ref(null);
const editingTypeName = ref('');
const editingTypeSortOrder = ref(0);

const scannedTags = ref([]);
const isLoadingScannedTags = ref(false);
const showScanner = ref(false);
const selectedScannedTags = ref([]);
const selectedTagType = ref(null);

const createType = async () => {
  if (!newTypeName.value.trim()) return;
  try {
    await axios.post('/api/v1/tag_types', {
      name: newTypeName.value,
      sort_order: newTypeSortOrder.value,
    });
    newTypeName.value = '';
    newTypeSortOrder.value = 0;
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to create tag type:', error);
    alert('错误：' + (error.response?.data?.error || '无法创建标签类型。'));
  }
};

const startScan = async () => {
  showScanner.value = true;
  isLoadingScannedTags.value = true;
  selectedScannedTags.value = [];
  if (props.types.length > 0) {
    selectedTagType.value = props.types[0].id;
  }
  try {
    const response = await axios.get('/api/v1/tags/scan-undefined-tags');
    scannedTags.value = response.data;
  } catch (error) {
    console.error('Failed to scan for undefined tags:', error);
    alert('错误：' + (error.response?.data?.error || '无法扫描标签。'));
  } finally {
    isLoadingScannedTags.value = false;
  }
};

const addSelectedTags = async () => {
  if (selectedScannedTags.value.length === 0 || !selectedTagType.value) {
    alert('请选择标签和标签类型。');
    return;
  }

  try {
    for (const tagName of selectedScannedTags.value) {
      await axios.post('/api/v1/tags', {
        name: tagName,
        type_id: selectedTagType.value,
      });
    }
    alert('所选标签添加成功！');
    showScanner.value = false;
    scannedTags.value = [];
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to add tags:', error);
    alert('错误：' + (error.response?.data?.error || '无法添加标签。'));
  }
};

const deleteType = async (id) => {
  if (!confirm('确定要删除此标签类型吗？')) return;
  try {
    await axios.delete(`/api/v1/tag_types/${id}`);
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to delete tag type:', error);
    alert('错误：' + (error.response?.data?.error || '无法删除标签类型。'));
  }
};

const startEditing = (type) => {
  editingTypeId.value = type.id;
  editingTypeName.value = type.name;
  editingTypeSortOrder.value = type.sort_order;
};

const cancelEditing = () => {
  editingTypeId.value = null;
};

const saveEdit = async () => {
  if (!editingTypeName.value.trim()) return;
  try {
    await axios.put(`/api/v1/tag_types/${editingTypeId.value}`, {
      name: editingTypeName.value,
      sort_order: editingTypeSortOrder.value,
    });
    cancelEditing();
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to update tag type:', error);
    alert('错误：' + (error.response?.data?.error || '无法更新标签类型。'));
  }
};

</script>

<template>
  <div class="space-y-3">
    <div v-for="type in types" :key="type.id" class="p-2 rounded-md bg-gray-50 flex items-center justify-between">
      <div v-if="editingTypeId === type.id" class="flex-grow flex items-center space-x-2">
        <input v-model="editingTypeName" type="text" class="p-1 border rounded-md w-full" />
        <input v-model="editingTypeSortOrder" type="number" class="p-1 border rounded-md w-20" />
        <button @click="saveEdit" class="btn btn-primary btn-sm">&#10003;</button>
        <button @click="cancelEditing" class="btn btn-danger btn-sm">&#10005;</button>
      </div>
      <div v-else class="flex-grow">
        <span class="font-medium">{{ type.name }}</span>
        <span class="text-xs text-gray-500 ml-2">（{{ $t('sortOrder') }}：{{ type.sort_order }}）</span>
      </div>
      <div v-if="editingTypeId !== type.id" class="flex space-x-2">
        <button @click="startEditing(type)" class="btn btn-secondary btn-sm">{{ $t('edit') }}</button>
        <button @click="deleteType(type.id)" class="btn btn-danger btn-sm">{{ $t('delete') }}</button>
      </div>
    </div>

    <!-- Create Form -->
    <div class="mt-4">
      <div v-if="!isCreating" @click="isCreating = true" class="cursor-pointer text-blue-600 hover:underline">
        + {{ $t('newType') }}
      </div>
      <div v-else class="p-3 bg-blue-50 rounded-md">
        <input v-model="newTypeName" type="text" :placeholder="$t('typeName')" class="p-1 border rounded-md w-full mb-2" />
        <input v-model="newTypeSortOrder" type="number" :placeholder="$t('sortValue')" class="p-1 border rounded-md w-full mb-2" />
        <div class="flex space-x-2">
          <button @click="createType" class="btn btn-primary">{{ $t('save') }}</button>
          <button @click="isCreating = false" class="btn btn-secondary">{{ $t('cancel') }}</button>
        </div>
      </div>
    </div>
    <hr />
    <!-- Undefined Tag Scanner -->
    <div class="mt-4">
        <button @click="startScan" class="btn btn-primary">
            {{ $t('scanNewTags') }}
        </button>
    </div>
    <div v-if="showScanner" class="mt-4 p-4 border rounded-md bg-gray-50">
      <h4 class="font-semibold text-lg mb-2">{{ $t('foundUndefinedTags') }}</h4>
      <div v-if="isLoadingScannedTags">{{ $t('loading') }}...</div>
      <div v-else-if="scannedTags.length === 0">{{ $t('noNewTagsFound') }}</div>
      <div v-else>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 bg-white border rounded">
            <label v-for="tag in scannedTags" :key="tag" class="flex items-center space-x-2">
                <input type="checkbox" :value="tag" v-model="selectedScannedTags" class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50" />
                <span>{{ tag }}</span>
            </label>
        </div>
        <div class="mt-4 flex items-center space-x-4">
            <select v-model="selectedTagType" class="p-1 border rounded-md">
                <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
            <button @click="addSelectedTags" class="btn btn-primary" :disabled="selectedScannedTags.length === 0">{{ $t('addSelectedTags') }}</button>
            <button @click="showScanner = false" class="btn btn-secondary">{{ $t('close') }}</button>
        </div>
        <p class="text-sm text-gray-600 mt-2">{{ $t('tagsSelected', { count: selectedScannedTags.length }) }}</p>
      </div>
    </div>
  </div>
</template> 
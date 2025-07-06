<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';

const props = defineProps({
  tags: Array,
  types: Array,
});

const emit = defineEmits(['dataChanged']);

const selectedTypeId = ref(null); // For filtering
const isCreating = ref(false);

// Form for new tag
const newTag = ref({
  name: '',
  type_id: null,
  parent_id: null,
  description: '',
});

const filteredTags = computed(() => {
  if (!selectedTypeId.value) {
    return props.tags;
  }
  return props.tags.filter(t => t.type_id === selectedTypeId.value);
});

const createTag = async () => {
  if (!newTag.value.name.trim() || !newTag.value.type_id) {
    alert('名称和类型为必填项。');
    return;
  }
  try {
    await axios.post('/api/v1/tags', newTag.value);
    isCreating.value = false;
    newTag.value = { name: '', type_id: null, parent_id: null, description: '' };
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to create tag:', error);
    alert('创建标签出错。');
  }
};

const deleteTag = async (id) => {
  if (!confirm('确定要删除此标签吗？')) return;
  try {
    await axios.delete(`/api/v1/tags/${id}`);
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to delete tag:', error);
    alert('删除标签出错。');
  }
};

</script>

<template>
  <div>
    <!-- Filter and Actions -->
    <div class="flex justify-between items-center mb-4">
      <select v-model="selectedTypeId" class="p-1 border rounded-md">
        <option :value="null">全部类型</option>
        <option v-for="type in types" :key="type.id" :value="type.id">
          {{ type.name }}
        </option>
      </select>
      <button @click="isCreating = true" class="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">
        + 新建标签
      </button>
    </div>

    <!-- Create Form Modal/Overlay -->
    <div v-if="isCreating" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
      <div class="p-6 bg-white rounded-lg shadow-xl w-96">
        <h3 class="text-lg font-bold mb-4">新建标签</h3>
        <div class="space-y-3">
          <input v-model="newTag.name" type="text" placeholder="标签名称" class="p-2 border rounded w-full" />
          <select v-model="newTag.type_id" class="p-2 border rounded w-full">
            <option :value="null" disabled>请选择类型</option>
            <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
          </select>
          <select v-model="newTag.parent_id" class="p-2 border rounded w-full">
            <option :value="null">无父标签</option>
            <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
          </select>
          <textarea v-model="newTag.description" placeholder="描述..." class="p-2 border rounded w-full h-24"></textarea>
        </div>
        <div class="mt-4 flex justify-end space-x-2">
          <button @click="isCreating = false" class="px-4 py-2 bg-gray-200 rounded">取消</button>
          <button @click="createTag" class="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
        </div>
      </div>
    </div>

    <!-- Tag List -->
    <div class="space-y-2">
      <div v-for="tag in filteredTags" :key="tag.id" class="p-3 bg-gray-50 rounded-md">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-bold">{{ tag.name }}</p>
            <p v-if="tag.description" class="text-sm text-gray-600">{{ tag.description }}</p>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="alias in tag.aliases" :key="alias" class="px-2 py-0.5 text-xs bg-green-200 text-green-800 rounded-full">
                {{ alias }}
              </span>
            </div>
          </div>
          <div class="flex-shrink-0">
            <button @click="deleteTag(tag.id)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
            <!-- Edit button will go here -->
          </div>
        </div>
      </div>
    </div>

  </div>
</template> 
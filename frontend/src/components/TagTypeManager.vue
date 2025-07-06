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
    alert('Error: ' + (error.response?.data?.error || 'Could not create tag type.'));
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
    alert('Error: ' + (error.response?.data?.error || 'Could not scan for tags.'));
  } finally {
    isLoadingScannedTags.value = false;
  }
};

const addSelectedTags = async () => {
  if (selectedScannedTags.value.length === 0 || !selectedTagType.value) {
    alert('Please select tags and a tag type.');
    return;
  }

  try {
    for (const tagName of selectedScannedTags.value) {
      await axios.post('/api/v1/tags', {
        name: tagName,
        type_id: selectedTagType.value,
      });
    }
    alert('Selected tags added successfully!');
    showScanner.value = false;
    scannedTags.value = [];
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to add tags:', error);
    alert('Error: ' + (error.response?.data?.error || 'Could not add tags.'));
  }
};

const deleteType = async (id) => {
  if (!confirm('Are you sure you want to delete this tag type?')) return;
  try {
    await axios.delete(`/api/v1/tag_types/${id}`);
    emit('dataChanged');
  } catch (error) {
    console.error('Failed to delete tag type:', error);
    alert('Error: ' + (error.response?.data?.error || 'Could not delete tag type.'));
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
    alert('Error: ' + (error.response?.data?.error || 'Could not update tag type.'));
  }
};

</script>

<template>
  <div class="space-y-3">
    <div v-for="type in types" :key="type.id" class="p-2 rounded-md bg-gray-50 flex items-center justify-between">
      <div v-if="editingTypeId === type.id" class="flex-grow flex items-center space-x-2">
        <input v-model="editingTypeName" type="text" class="p-1 border rounded-md w-full" />
        <input v-model="editingTypeSortOrder" type="number" class="p-1 border rounded-md w-20" />
        <button @click="saveEdit" class="text-green-600 hover:text-green-800">&#10003;</button>
        <button @click="cancelEditing" class="text-red-600 hover:text-red-800">&#10005;</button>
      </div>
      <div v-else class="flex-grow">
        <span class="font-medium">{{ type.name }}</span>
        <span class="text-xs text-gray-500 ml-2">(Order: {{ type.sort_order }})</span>
      </div>
      <div v-if="editingTypeId !== type.id" class="flex space-x-2">
        <button @click="startEditing(type)" class="text-blue-600 hover:text-blue-800">Edit</button>
        <button @click="deleteType(type.id)" class="text-red-600 hover:text-red-800">Del</button>
      </div>
    </div>

    <!-- Create Form -->
    <div class="mt-4">
      <div v-if="!isCreating" @click="isCreating = true" class="cursor-pointer text-blue-600 hover:underline">
        + Add New Type
      </div>
      <div v-else class="p-3 bg-blue-50 rounded-md">
        <input v-model="newTypeName" type="text" placeholder="Type name" class="p-1 border rounded-md w-full mb-2" />
        <input v-model="newTypeSortOrder" type="number" placeholder="Sort order" class="p-1 border rounded-md w-full mb-2" />
        <div class="flex space-x-2">
          <button @click="createType" class="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
          <button @click="isCreating = false" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
        </div>
      </div>
    </div>
    <hr />
    <!-- Undefined Tag Scanner -->
    <div class="mt-4">
        <button @click="startScan" class="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700">
            Scan for new tags from filenames
        </button>
    </div>
    <div v-if="showScanner" class="mt-4 p-4 border rounded-md bg-gray-50">
      <h4 class="font-semibold text-lg mb-2">Found Undefined Tags</h4>
      <div v-if="isLoadingScannedTags">Loading...</div>
      <div v-else-if="scannedTags.length === 0">No new undefined tags found in filenames.</div>
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
            <button @click="addSelectedTags" class="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700" :disabled="selectedScannedTags.length === 0">Add Selected Tags</button>
            <button @click="showScanner = false" class="px-3 py-1 bg-gray-200 rounded-md hover:bg-gray-300">Close</button>
        </div>
        <p class="text-sm text-gray-600 mt-2">{{ selectedScannedTags.length }} tag(s) selected.</p>
      </div>
    </div>
  </div>
</template> 
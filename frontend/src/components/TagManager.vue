<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';

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
    alert('Error: Could not fetch tags.');
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

onMounted(fetchTags);

const getTypeName = (typeId) => {
  const type = props.types.find(t => t.id === typeId);
  return type ? type.name : 'N/A';
};

const getParentName = (parentId) => {
    if (!parentId) return 'None';
    const parent = tags.value.find(t => t.id === parentId);
    return parent ? parent.name : 'N/A';
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
    alert('Tag Name and Type are required.');
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
    alert('Error: ' + (error.response?.data?.error || 'Could not save tag.'));
  }
};

const deleteTag = async (id) => {
    if (!confirm('Are you sure you want to delete this tag? This cannot be undone.')) return;
    try {
        await axios.delete(`/api/v1/tags/${id}`);
        fetchTags(); // Refresh tag list
    } catch (error) {
        console.error('Failed to delete tag:', error);
        alert('Error: ' + (error.response?.data?.error || 'Could not delete tag.'));
    }
}

const availableParents = computed(() => {
    return tags.value.filter(tag => tag.id !== editingTag.value?.id);
});

</script>

<template>
  <div class="p-4 bg-white rounded-lg shadow-md">
    <h3 class="text-xl font-semibold mb-4">Tag Management</h3>

    <!-- Filter and Actions -->
    <div class="flex justify-between items-center mb-4">
  <div>
        <label for="type-filter" class="mr-2 font-medium">Filter by Type:</label>
        <select id="type-filter" v-model="selectedTypeId" class="p-2 border rounded-md">
          <option value="all">All Types</option>
          <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
        </select>
      </div>
      <button @click="openCreateModal" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
        + Create New Tag
      </button>
    </div>

    <!-- Tags Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left py-2 px-4">Name</th>
            <th class="text-left py-2 px-4">Description</th>
            <th class="text-left py-2 px-4">Type</th>
            <th class="text-left py-2 px-4">Parent</th>
            <th class="text-left py-2 px-4">Aliases</th>
            <th class="text-left py-2 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="6" class="text-center py-4">Loading...</td>
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
                <button @click="openEditModal(tag)" class="text-blue-600 hover:text-blue-800">Edit</button>
                <button @click="deleteTag(tag.id)" class="text-red-600 hover:text-red-800">Delete</button>
              </div>
            </td>
          </tr>
           <tr v-if="!isLoading && filteredTags.length === 0">
            <td colspan="6" class="text-center py-4 text-gray-500">No tags found for the selected type.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h4 class="text-lg font-bold mb-4">{{ editingTag ? 'Edit Tag' : 'Create New Tag' }}</h4>
        
        <!-- Form -->
        <div class="space-y-4">
          <div>
            <label class="block font-medium">Name <span class="text-red-500">*</span></label>
            <input v-model="tagForm.name" type="text" class="p-2 border rounded-md w-full">
          </div>
          <div>
            <label class="block font-medium">Description</label>
            <textarea v-model="tagForm.description" rows="2" class="p-2 border rounded-md w-full"></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block font-medium">Type <span class="text-red-500">*</span></label>
              <select v-model="tagForm.type_id" class="p-2 border rounded-md w-full">
                <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
              </select>
            </div>
            <div>
              <label class="block font-medium">Parent Tag</label>
              <select v-model="tagForm.parent_id" class="p-2 border rounded-md w-full">
                <option :value="null">-- No Parent --</option>
                <option v-for="parent in availableParents" :key="parent.id" :value="parent.id">{{ parent.name }}</option>
              </select>
            </div>
      </div>

          <!-- Aliases -->
          <div>
            <label class="block font-medium">Aliases</label>
            <div class="flex items-center space-x-2 mb-2">
                <input v-model="tagForm.newAlias" @keyup.enter="addAlias" type="text" placeholder="Add an alias and press Enter" class="p-2 border rounded-md flex-grow">
                <button @click="addAlias" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Add</button>
            </div>
            <div class="flex flex-wrap gap-2">
                <span v-for="alias in tagForm.aliases" :key="alias" class="flex items-center bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                    {{ alias }}
                    <button @click="removeAlias(alias)" class="ml-2 text-red-500 hover:text-red-700">&times;</button>
                </span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 flex justify-end space-x-3">
          <button @click="closeModal" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
          <button @click="saveTag" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Tag</button>
        </div>
      </div>
    </div>
  </div>
</template> 

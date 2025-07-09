<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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

onMounted(fetchTags);

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
      <button @click="openCreateModal" class="btn btn-primary">
        + {{ $t('newTag') }}
      </button>
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
  </div>
</template> 

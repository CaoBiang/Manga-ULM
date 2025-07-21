<template>
  <div class="p-8 max-w-4xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">{{ $t('editFileDetails') }}</h1>
      <button @click="goBack" class="btn btn-secondary">
        {{ $t('back') }}
      </button>
    </div>
    <div v-if="loading" class="text-center">
      <p>{{ $t('loading') }}</p>
    </div>
    <div v-else-if="error" class="text-center text-red-500">
      <p>{{ $t('errorLoadingData', { error: error }) }}</p>
    </div>
    <div v-else-if="file" class="space-y-6">
      <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-lg font-semibold border-b pb-2 mb-4">{{ $t('metadata') }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div class="col-span-full">
            <strong class="font-medium text-gray-600">{{ $t('filename') }}:</strong>
            <div class="flex items-center gap-2 mt-1">
              <input type="text" v-model="editableFilename" class="flex-grow p-2 border rounded-md">
              <button @click="handleRename" :disabled="isRenaming" class="btn btn-secondary">
                {{ isRenaming ? $t('renaming') : $t('rename') }}
              </button>
            </div>
            <p v-if="renameStatus === 'error'" class="text-red-500 text-sm mt-1">{{ renameError }}</p>
            <p v-if="renameStatus === 'success'" class="text-green-500 text-sm mt-1">{{ $t('renameSuccess') }}</p>
          </div>
          <div><strong class="font-medium text-gray-600">{{ $t('pages') }}:</strong> <span class="text-gray-800">{{ file.total_pages }}</span></div>
          <div class="col-span-full"><strong class="font-medium text-gray-600">{{ $t('fullPath') }}:</strong> <span class="text-gray-800 break-all">{{ file.file_path }}</span></div>
          <div class="col-span-full"><strong class="font-medium text-gray-600">{{ $t('hash') }}:</strong> <span class="text-gray-800 break-all">{{ file.file_hash }}</span></div>
        </div>
      </div>
      
      <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-lg font-semibold border-b pb-2 mb-4">{{ $t('tags') }}</h2>
        <div class="flex items-start gap-4">
          <TagSelector v-model="file.tags" />
          <div v-if="file.tags && file.tags.length > 0" class="flex-grow pl-4">
            <div class="flex flex-wrap gap-2">
              <span v-for="tag in file.tags" :key="tag.id" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {{ tag.name }}
                <button @click="toggleTag(tag)" class="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white">
                  <span class="sr-only">{{ $t('removeTag') }}</span>
                  <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                    <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bookmarks Section -->
      <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-lg font-semibold border-b pb-2 mb-4">{{ $t('bookmarks') }}</h2>
        <!-- Add new bookmark form -->
        <div class="flex items-start gap-4 mb-6 pb-6 border-b">
          <input type="number" v-model.number="newBookmark.page" :placeholder="$t('pagePlaceholder')" min="1" class="w-24 p-2 border rounded-md">
          <input type="text" v-model="newBookmark.note" :placeholder="$t('noteOptional')" class="flex-grow p-2 border rounded-md">
          <button @click="addBookmark" :disabled="!newBookmark.page" class="btn btn-primary">{{ $t('add') }}</button>
        </div>
        <p v-if="bookmarkError" class="text-red-500 text-sm mb-4">{{ bookmarkError }}</p>

        <!-- Existing bookmarks list -->
        <div v-if="bookmarks.length" class="space-y-3">
            <div v-for="bookmark in bookmarks" :key="bookmark.id" class="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                <div>
                    <p class="font-semibold">{{ $t('page') }} {{ bookmark.page_number }}</p>
                    <p v-if="bookmark.note" class="text-sm text-gray-600">{{ bookmark.note }}</p>
                </div>
                <button @click="deleteBookmark(bookmark.id)" class="btn btn-danger btn-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                </button>
            </div>
        </div>
        <div v-else>
            <p class="text-gray-500">{{ $t('noBookmarksYet') }}</p>
        </div>
      </div>

      <div class="flex justify-end items-center gap-4 mt-6">
        <label class="flex items-center">
          <input type="checkbox" v-model="renameFileOnSave" class="h-4 w-4 text-monet-blue focus:ring-monet-blue border-gray-300 rounded">
          <span class="ml-2 text-sm text-gray-600">{{ $t('renameFileOnSave') }}</span>
        </label>
         <p v-if="saveStatus === 'success'" class="text-green-600">{{ $t('successfullySaved') }}</p>
         <p v-if="saveStatus === 'error'" class="text-red-500">{{ saveError }}</p>
        <button @click="handleSave" :disabled="isSaving" class="btn btn-primary">
          {{ isSaving ? $t('saving') : $t('saveChanges') }}
        </button>
      </div>

    </div>
  </div>
</template>


<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import TagSelector from '@/components/TagSelector.vue'

const route = useRoute()
const router = useRouter()
const file = ref(null)
const allTags = ref([])
const bookmarks = ref([])
const loading = ref(true)
const error = ref(null)
const renameFileOnSave = ref(true)
const editableFilename = ref('')

const isRenaming = ref(false)
const renameStatus = ref('idle') // idle, success, error
const renameError = ref(null)

const newBookmark = ref({ page: null, note: '' })
const bookmarkError = ref(null)

const goBack = () => {
  router.back()
}

const isSaving = ref(false)
const saveStatus = ref('idle') // idle, success, error
const saveError = ref(null)

const toggleTag = (tag) => {
    if (!file.value || !file.value.tags) return;
    const index = file.value.tags.findIndex(t => t.id === tag.id);
    if (index > -1) {
        file.value.tags.splice(index, 1);
    }
};

const addBookmark = async () => {
    bookmarkError.value = null
    if (!newBookmark.value.page || newBookmark.value.page < 1) {
        bookmarkError.value = "Page number must be a positive number, starting from 1.";
        return;
    }

    try {
        const response = await axios.post(`/api/v1/files/${file.value.id}/bookmarks`, {
            page_number: newBookmark.value.page,
            note: newBookmark.value.note
        });
        bookmarks.value.push(response.data);
        bookmarks.value.sort((a, b) => a.page_number - b.page_number); // Keep the list sorted
        // Reset form
        newBookmark.value.page = null;
        newBookmark.value.note = '';
    } catch (err) {
        bookmarkError.value = err.response?.data?.error || 'Failed to add bookmark.';
    }
}

const deleteBookmark = async (bookmarkId) => {
    bookmarkError.value = null
    try {
        await axios.delete(`/api/v1/bookmarks/${bookmarkId}`);
        bookmarks.value = bookmarks.value.filter(b => b.id !== bookmarkId);
    } catch (err) {
        bookmarkError.value = err.response?.data?.error || 'Failed to delete bookmark.';
    }
}

const handleSave = async () => {
  isSaving.value = true
  saveStatus.value = 'idle'
  saveError.value = null
  try {
    const payload = {
      tags: file.value.tags,
      rename_file: renameFileOnSave.value
    }
    const response = await axios.put(`/api/v1/files/${file.value.id}`, payload)
    file.value = response.data // Update local state with response from server
    saveStatus.value = 'success'
     setTimeout(() => saveStatus.value = 'idle', 3000) // Reset after 3s
  } catch (err) {
    saveStatus.value = 'error'
    saveError.value = err.response?.data?.error || 'An unexpected error occurred.'
  } finally {
    isSaving.value = false
  }
}

const handleRename = async () => {
  if (!editableFilename.value || !file.value) return;

  // Extract filename without extension
  const currentFilenameWithoutExt = editableFilename.value.includes('.')
    ? editableFilename.value.substring(0, editableFilename.value.lastIndexOf('.'))
    : editableFilename.value;

  isRenaming.value = true
  renameStatus.value = 'idle'
  renameError.value = null
  try {
    await axios.post(`/api/rename/file/${file.value.id}`, {
      new_filename: currentFilenameWithoutExt
    })
    renameStatus.value = 'success'
    // The backend will emit a socket event, so we might not need to update the path manually here.
    // However, it's good practice to update it for immediate feedback.
    const parts = file.value.file_path.split(/[\\/]/);
    const ext = parts.pop().split('.').pop();
    parts[parts.length - 1] = `${currentFilenameWithoutExt}.${ext}`;
    file.value.file_path = parts.join('/');
    editableFilename.value = `${currentFilenameWithoutExt}`

    setTimeout(() => renameStatus.value = 'idle', 3000)
  } catch (err) {
    renameStatus.value = 'error'
    renameError.value = err.response?.data?.error || 'An unexpected error occurred during rename.'
  } finally {
    isRenaming.value = false
  }
}

onMounted(async () => {
  const fileId = route.params.id
  try {
    const [fileResponse, tagsResponse, bookmarksResponse] = await Promise.all([
      axios.get(`/api/v1/files/${fileId}`),
      axios.get('/api/v1/tags'),
      axios.get(`/api/v1/files/${fileId}/bookmarks`),
    ])
    file.value = fileResponse.data
    allTags.value = tagsResponse.data
    bookmarks.value = bookmarksResponse.data
    if (file.value) {
      const filename = file.value.file_path.split(/[\\/]/).pop()
      editableFilename.value = filename.substring(0, filename.lastIndexOf('.'))
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
})
</script>

<style>
.btn {
  @apply py-2 px-4 rounded-md font-semibold text-sm transition-colors;
}
.btn-primary {
  @apply bg-monet-blue text-white hover:bg-blue-700 disabled:bg-gray-400;
}
.btn-secondary {
  @apply bg-monet-grey text-gray-800 hover:bg-gray-300;
}
.btn-danger {
  @apply bg-red-500 text-white hover:bg-red-600;
}
.btn-sm {
  @apply py-1 px-2 text-xs;
}
</style> 
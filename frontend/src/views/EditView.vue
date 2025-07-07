<template>
  <div class="p-8 max-w-4xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800">Edit File Details</h1>
      <button @click="goBack" class="btn btn-secondary">
        Back
      </button>
    </div>
    <div v-if="loading" class="text-center">
      <p>Loading...</p>
    </div>
    <div v-else-if="error" class="text-center text-red-500">
      <p>Error loading data: {{ error }}</p>
    </div>
    <div v-else-if="file" class="space-y-6">
      <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-lg font-semibold border-b pb-2 mb-4">Metadata</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><strong class="font-medium text-gray-600">Filename:</strong> <span class="text-gray-800 break-all">{{ file.file_path.split(/[\\/]/).pop() }}</span></div>
          <div><strong class="font-medium text-gray-600">Pages:</strong> <span class="text-gray-800">{{ file.total_pages }}</span></div>
          <div class="col-span-full"><strong class="font-medium text-gray-600">Full Path:</strong> <span class="text-gray-800 break-all">{{ file.file_path }}</span></div>
          <div class="col-span-full"><strong class="font-medium text-gray-600">Hash:</strong> <span class="text-gray-800 break-all">{{ file.file_hash }}</span></div>
        </div>
      </div>
      
      <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-lg font-semibold border-b pb-2 mb-4">Tags</h2>
        <VueMultiselect
          v-model="file.tags"
          :options="allTags"
          :multiple="true"
          :close-on-select="false"
          :clear-on-select="false"
          placeholder="Select tags"
          label="name"
          track-by="id"
        />
      </div>

      <!-- Bookmarks Section -->
      <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-lg font-semibold border-b pb-2 mb-4">Bookmarks</h2>
        <!-- Add new bookmark form -->
        <div class="flex items-start gap-4 mb-6 pb-6 border-b">
          <input type="number" v-model.number="newBookmark.page" placeholder="Page" min="1" class="w-24 p-2 border rounded-md">
          <input type="text" v-model="newBookmark.note" placeholder="Note (optional)" class="flex-grow p-2 border rounded-md">
          <button @click="addBookmark" :disabled="!newBookmark.page" class="btn btn-primary">Add</button>
        </div>
        <p v-if="bookmarkError" class="text-red-500 text-sm mb-4">{{ bookmarkError }}</p>

        <!-- Existing bookmarks list -->
        <div v-if="bookmarks.length" class="space-y-3">
            <div v-for="bookmark in bookmarks" :key="bookmark.id" class="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                <div>
                    <p class="font-semibold">Page {{ bookmark.page_number }}</p>
                    <p v-if="bookmark.note" class="text-sm text-gray-600">{{ bookmark.note }}</p>
                </div>
                <button @click="deleteBookmark(bookmark.id)" class="btn btn-danger btn-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                </button>
            </div>
        </div>
        <div v-else>
            <p class="text-gray-500">No bookmarks for this file yet.</p>
        </div>
      </div>

      <div class="flex justify-end items-center gap-4 mt-6">
         <p v-if="saveStatus === 'success'" class="text-green-600">Successfully saved!</p>
         <p v-if="saveStatus === 'error'" class="text-red-500">{{ saveError }}</p>
        <button @click="handleSave" :disabled="isSaving" class="btn btn-primary">
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style src="vue-multiselect/dist/vue-multiselect.css"></style>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import VueMultiselect from 'vue-multiselect'

const route = useRoute()
const router = useRouter()
const file = ref(null)
const allTags = ref([])
const bookmarks = ref([])
const loading = ref(true)
const error = ref(null)

const newBookmark = ref({ page: null, note: '' })
const bookmarkError = ref(null)

const goBack = () => {
  router.back()
}

const isSaving = ref(false)
const saveStatus = ref('idle') // idle, success, error
const saveError = ref(null)

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
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
})
</script> 
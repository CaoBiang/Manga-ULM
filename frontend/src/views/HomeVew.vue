<template>
  <div class="p-4 sm:p-6">
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Library</h1>

    <!-- Filters Section -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <div class="flex items-center space-x-4">
        <div ref="filterContainer" class="relative inline-block text-left z-50">
          <div>
            <button @click="isFilterOpen = !isFilterOpen" type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Filter by Tags
              <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <div v-if="isFilterOpen" class="origin-top-left absolute left-0 mt-2 w-max rounded-md shadow-2xl bg-white ring-1 ring-black ring-opacity-5 flex focus:outline-none">
            <div class="flex">
              <!-- Left Panel: Tag Types -->
              <div class="w-48 border-r border-gray-200 py-1">
                <a v-for="tagType in allTagTypes" :key="tagType.id" href="#"
                  @mouseover="hoveredType = tagType"
                  class="block px-4 py-2 text-sm text-gray-700"
                  :class="{ 'bg-gray-100': hoveredType && hoveredType.id === tagType.id }">
                  {{ tagType.name }}
                </a>
              </div>

              <!-- Right Panel: Tags -->
              <div class="w-72 py-1">
                <div v-if="!hoveredType" class="px-4 py-2 text-sm text-gray-500">
                  Hover over a type to see tags.
                </div>
                <div v-else class="max-h-96 overflow-y-auto">
                  <a v-for="tag in tagsOfHoveredType" :key="tag.id" href="#"
                    @click.prevent="toggleTag(tag)"
                    class="flex justify-between items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <span>{{ tag.name }}</span>
                    <svg v-if="isTagSelected(tag)" class="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Keyword Search -->
        <div class="flex-grow">
          <input
            v-model="keyword"
            type="text"
            placeholder="Search by keyword..."
            class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <!-- Display selected tags -->
      <div v-if="selectedTags.length > 0" class="mt-4">
        <span v-for="tag in selectedTags" :key="tag.id" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2 mb-2">
          {{ tag.name }}
          <button @click="toggleTag(tag)" class="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white">
            <span class="sr-only">Remove tag</span>
            <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
              <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
            </svg>
          </button>
        </span>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      Loading...
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isFilterOpen: false,
      hoveredType: null,
      keyword: '',
      selectedTags: [],
      allTagTypes: [],
      tagsOfHoveredType: [],
      isLoading: true
    };
  },
  methods: {
    toggleTag(tag) {
      if (this.isTagSelected(tag)) {
        this.selectedTags = this.selectedTags.filter(t => t.id !== tag.id);
      } else {
        this.selectedTags.push(tag);
      }
    },
    isTagSelected(tag) {
      return this.selectedTags.some(t => t.id === tag.id);
    }
  },
  async mounted() {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      this.allTagTypes = data.tagTypes;
      this.tagsOfHoveredType = data.tags;
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      this.isLoading = false;
    }
  }
};
</script> 
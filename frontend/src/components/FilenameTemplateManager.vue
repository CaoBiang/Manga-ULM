<script setup>
import { ref, computed, onMounted } from 'vue';

const templateString = ref('');
const savedTemplate = ref('');

// Example data for preview
const exampleData = {
  series: 'The Quintessential Quintuplets',
  author: 'Negi Haruba',
  volume_number: '01',
  'custom_tag:character': 'Miku Nakano',
  'custom_tag:publisher': 'Kodansha'
};

const availablePlaceholders = [
  '{series}', '{author}', '{title}', '{volume_number}', '{year}',
  // Example for custom tags
  '{custom_tag:character}', '{custom_tag:publisher}' 
];

const previewFileName = computed(() => {
  let result = templateString.value;
  for (const key in exampleData) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), exampleData[key]);
  }
  // Replace any remaining (unmatched) placeholders with an empty string
  result = result.replace(/\{[^}]+\}/g, '');
  // Sanitize illegal characters
  return result.replace(/[\\/:*?"<>|]/g, '_') + '.zip';
});

const addPlaceholder = (placeholder) => {
  templateString.value += placeholder;
};

const saveTemplate = () => {
  localStorage.setItem('mangaFilenameTemplate', templateString.value);
  savedTemplate.value = templateString.value;
  alert('Template saved!');
};

onMounted(() => {
  const storedTemplate = localStorage.getItem('mangaFilenameTemplate');
  if (storedTemplate) {
    templateString.value = storedTemplate;
    savedTemplate.value = storedTemplate;
  }
});
</script>

<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">Filename Template Editor</h2>
    
    <div class="mb-4">
      <label class="block text-sm font-medium text-gray-600 mb-1">Available Placeholders:</label>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in availablePlaceholders" :key="p" @click="addPlaceholder(p)" class="px-2 py-1 bg-gray-200 text-sm rounded-md hover:bg-gray-300">
          {{ p }}
        </button>
      </div>
    </div>

    <div class="mb-4">
      <label for="template-input" class="block text-sm font-medium text-gray-600 mb-1">Template:</label>
      <input 
        id="template-input"
        type="text" 
        v-model="templateString" 
        placeholder="e.g., [{author}]/{series} - Vol.{volume_number}"
        class="w-full p-2 border rounded-md font-mono"
      />
    </div>
    
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-600 mb-1">Preview:</label>
      <div class="p-2 bg-gray-100 rounded-md text-gray-800 font-mono break-all">
        {{ previewFileName }}
      </div>
    </div>

    <div>
      <button @click="saveTemplate" class="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">
        Save Template
      </button>
    </div>

    <div v-if="savedTemplate" class="mt-4 text-sm text-gray-500">
      <strong>Currently saved template:</strong> {{ savedTemplate }}
    </div>
  </div>
</template> 
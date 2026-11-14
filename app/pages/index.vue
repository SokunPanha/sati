<script setup lang="ts">
// "/" is the install landing page for browser visitors without a profile. With a profile (or in the installed
// app) the profile middleware sends "/" on to /today or /welcome, so this page only ever shows the landing page.
definePageMeta({ wide: true })
</script>

<template>
  <LandingPage />
</template>

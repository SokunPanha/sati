<script setup lang="ts">
// "/" is the app's Today screen. A browser visitor without a profile sees the install landing page here
// instead (the installed app goes to the welcome flow; see the profile middleware).
const { active } = useProfile()
</script>

<template>
  <TodayPage v-if="active" />
  <LandingPage v-else />
</template>

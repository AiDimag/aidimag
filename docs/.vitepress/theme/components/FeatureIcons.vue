<script setup lang="ts">
import { onMounted, h, createApp } from "vue";
import {
  Brain,
  BadgeCheck,
  ShieldAlert,
  Plug,
  Users,
  LockKeyhole,
} from "lucide-vue-next";

const icons = [Brain, BadgeCheck, ShieldAlert, Plug, Users, LockKeyhole];

onMounted(() => {
  const featureIcons = document.querySelectorAll(".VPFeature .icon");
  featureIcons.forEach((el, i) => {
    if (i < icons.length) {
      el.innerHTML = "";
      el.classList.add("lucide-icon");
      const Icon = icons[i];
      const app = createApp({
        render: () => h(Icon, { size: 22, strokeWidth: 1.8 }),
      });
      const wrapper = document.createElement("span");
      app.mount(wrapper);
      el.appendChild(wrapper);
    }
  });
});
</script>

<template></template>

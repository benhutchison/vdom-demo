import { mount } from "svelte";
import App from "./App.svelte";

window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const state = $state(initialState); // a deeply-reactive proxy object
  mount(App, { target: container, props: { state } });
  return {
    update(newState) {
      state.region = newState.region;
      state.flights = newState.flights;
    }
  };
};

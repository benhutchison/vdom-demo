// implementations/elm/main.js - the mount-contract adapter
window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const app = Elm.Main.init({ node: container, flags: initialState });
  return { update(newState) { app.ports.stateUpdates.send(newState); } };
};

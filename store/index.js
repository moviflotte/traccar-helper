export const state = {
  session: null,
  devices: [],
  geofences: [],
  groups: []
}

export const getters = {
  session: (state) => state.session,
  geofences: (state) => state.geofences,
  groups: (state) => state.groups,
  devices: (state) => state.devices
}

export const actions = {
  async addDevice ({ commit }, name) {
    await this.$axios.$post('devices', { name, uniqueId: name })
    commit('SET_DEVICES', await this.$axios.$get('devices'))
  },
  async addGeofence ({ commit }, {name, area}) {
    await this.$axios.$post('geofences', { name, area })
    commit('SET_GEOFENCES', await this.$axios.$get('geofences'))
  },
  async getUserData ({ commit }) {
    commit('SET_SESSION', await this.$axios.$get('session'))
    commit('SET_DEVICES', await this.$axios.$get('devices'))
  }
}
export const mutations = {
  SET_SESSION (state, session) {
    state.session = session
  },
  SET_DEVICES (state, devices) {
    state.devices = devices
  }
}

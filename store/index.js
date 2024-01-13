const maxGeofences = 1000

export const state = {
  session: null,
  devices: [],
  geofences: [],
  groups: [],
  users: [],
  geofencesLength: 0
}

export const getters = {
  session: (state) => state.session,
  geofences: (state) => state.geofences,
  groups: (state) => state.groups,
  devices: (state) => state.devices,
  users: (state) => state.users,
  geofencesLength: (state) => state.geofencesLength
}

export const actions = {
  async addPermission ({ commit }, data) {
    await this.$axios.$post('permissions', data)
  },
  async addDevice ({ commit }, name) {
    await this.$axios.$post('devices', { name, uniqueId: name })
    commit('SET_DEVICES', await this.$axios.$get('devices'))
  },
  async addGeofence ({ commit }, { name, area, description }) {
    return this.$axios.$post('geofences', { name, area, description })
  },
  async updateGeofence ({ commit }, geofence) {
    await this.$axios.$put('geofences/' + geofence.id, geofence)
  },
  async removeGeofence ({ commit }, geofenceId) {
    await this.$axios.$delete('geofences/' + geofenceId)
  },
  async removeGeofences ({ commit }, geofenceIds) {
    await this.$axios.$delete(`../reports/geofences/bulk/delete?${geofenceIds.map(id => `id=${id}`).join('&')}`)
  },
  async getDevices ({ commit }, userId) {
    commit('SET_DEVICES', await this.$axios.$get('devices' + (userId ? `?userId=${userId}` : '')))
  },
  async getUserData ({ commit, dispatch }) {
    try {
      await dispatch('getDevices')
      commit('SET_SESSION', await this.$axios.$get('session'))
      commit('SET_GEOFENCES', await this.$axios.$get('geofences'))
      commit('SET_GROUPS', await this.$axios.$get('groups'))
      commit('SET_USERS', await this.$axios.$get('users'))
    } catch (e) {
      alert((e.response && e.response.data) || e.message || e)
    }
  },
  async getComputed ({ commit, state }) {
    for (const d of state.devices) {
      d.computed = await this.$axios.$get('/attributes/computed?deviceId=' + d.id)
      commit('SET_DEVICE', d)
    }
  }
}
export const mutations = {
  SET_DEVICE (state, device) {
    state.devices.splice(state.devices.indexOf(device), 1, device)
  },
  SET_SESSION (state, session) {
    state.session = session
  },
  SET_DEVICES (state, devices) {
    state.devices = devices
  },
  SET_GROUPS (state, groups) {
    state.groups = groups
  },
  SET_USERS (state, users) {
    state.users = users
  },
  SET_GEOFENCES (state, geofences) {
    state.geofences = geofences.sort((a, b) => a.name.localeCompare(b.name)).slice(0, maxGeofences)
    state.geofencesLength = geofences.length
  },
  SET_GEOFENCES_LENGTH (state, geofencesLength) {
    state.geofencesLength = geofencesLength
  }
}

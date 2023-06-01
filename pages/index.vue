<template>
  <div>
    user: {{this.session && this.session.email}}
    <br>
    <br>
    {{geofences.length}} geofences:
    <button @click="showGeofences=!showGeofences">{{showGeofences?'hide':'show'}}</button>
    <ol v-if="showGeofences">
      <li v-for="d of geofences" :key="d.id">geofence {{d.attributes}}</li>
    </ol>
    <br>
    ADD GEOFENCE
    <input ref="file" type="file" value="ADD GEOFENCE" @change="addGeofence">
    <p></p>
    {{geofences.length}} groups:
    <ol>
      <li v-for="d of groups" :key="d.id">group {{d}}</li>
    </ol>
    {{devices.length}} devices:
    <button @click="showDevices=!showDevices">{{showDevices?'hide':'show'}}</button>
    <ol v-if="showDevices">
      <li v-for="d of devices" :key="d.id">{{d}}</li>
    </ol>
    <input type="button" value="ADD DEVICE" @click="addDevice">
    <input type="button" value="REMOVE ATTRIBUTE" @click="removeAttribute">
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { stringify } from 'wellknown'

export default {
  name: 'IndexPage',
  data () {
    return {
      file: null,
      showDevices: true,
      showGeofences: false
    }
  },
  computed: {
    ...mapGetters(['session', 'devices', 'geofences', 'groups'])
  },
  methods: {
    addDevice () {
      this.$store.dispatch('addDevice', prompt('Device name?'))
    },
    removeAttribute () {
      this.$store.dispatch('removeAttribute')
    },
    addGeofence () {
      const name = prompt('Name?')
      this.file = this.$refs.file.files[0]
      const reader = new FileReader()
      reader.onload = (res) => {
        const content = JSON.parse(res.target.result)
        console.log('json', content)
        const feature = content.features[0]
        console.log('feature', feature)
        feature.geometry.coordinates = feature.geometry.coordinates.map(c => [c[1].toFixed(6), c[0].toFixed(6)])
        const geojson = stringify(feature)
        console.log('geojson', geojson)
        const area = stringify(feature)
        this.$store.dispatch('addGeofence', { name, area })
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },

    async processDevices () {
      const devices = await this.$axios.$get('devices', { withCredentials: true })
      for (const d of devices) {
        d.category = 'truck'
        await this.$axios.$put('devices' + d.id, d, { withCredentials: true })
      }
    },
    async getDrivers () {
      const drivers = await this.$axios.$get('drivers', { withCredentials: true })
      this.drivers = drivers.filter(d => d.uniqueId.startsWith('01'))
      console.log(this.drivers.length)
      for (const d of this.drivers) {
        try {
          d.uniqueId = d.uniqueId.substring(0, 10)
          console.log(d.uniqueId)
          await this.$axios.$put('drivers' + d.id, d, { withCredentials: true })
        } catch (e) {
          console.error(e)
        }
      }
    },
    async getGeofences () {
      this.geofences = await this.$axios.$get('geofences')
      this.groups = await this.$axios.$get('groups')
    },
    async processGeofences () {
      for (const geofence of this.geofences) {
        const group = this.groups.find(g => g.attributes && g.attributes.i_poigroupid === geofence.attributes.iGroupId)
        await this.$axios.$post('permissions', { groupId: group.id, geofenceId: geofence.id })
      }
    },
    async insertGeofences () {
      /* const {Data} = await import('../components/pois.json')

      for(const p of Data.map(p => {
        return {
          name: p.name,
          area: 'CIRCLE (' + p.center.Latitude + ' ' + p.center.Longitude + ', 100)',
        }
      })) {
        await this.$axios.$post('/geofences', p)
      } */
    }
  },
  async mounted () {
    await this.$store.dispatch('getUserData')
  }
}
</script>

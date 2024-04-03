<template>
  <div>
    <div id="loader" v-if="loading"></div>
    <div style="display: flex; justify-content: center;">
      <img :src="logo" width="40%" style="padding: 10px" alt="logo">
    </div>
    user: {{this.session && this.session.email}} {{this.session && this.session.id}}
    <br/>
    <p></p>
    {{geofencesLength}} geofences:
    <button @click="showGeofences=!showGeofences">{{showGeofences?'Hide':'Show'}}</button>
    <button @click="selectedGeofences = geofences.map(g => g.id)">Select all</button>
    <ol v-if="showGeofences">
      <li v-for="d of geofences" :key="d.id" @click="toggleSelectedGeofence(d.id)"
          :style="selectedGeofences.includes(d.id)?'background-color: yellow':''">{{d.name}} {{d.id}} {{d.attributes}} {{d.area}}</li>
    </ol>
    <input @click="removeGeofences" :value="`Delete selected (${selectedGeofences.length})`" type="button">
    <p></p>
    <input @click="removeDuplicated" value="Delete duplicated" type="button">
    <p></p>
    <input @click="removeInvalid" value="Delete invalid" type="button">
    <p></p>
    Add Geofence from GeoJSON:
    <input ref="file" type="file" @change="addGeofence">
    <p></p>
    <select v-model="groupId">
      <option v-for="d of groups" :key="d.id" :value="d.id"
              :style="selectedGroups.includes(d.id)?'background-color: yellow':''">{{d.name}}</option>
    </select>
    POIs from CSV (name;latitude;longitude;radius;description):
    <input ref="csv" type="file" @change="addGeofencesFromCSV">
    <p></p>
    <p></p>
    {{devices.length}} devices:
    <button @click="showDevices=!showDevices">{{showDevices?'Hide':'Show'}}</button>
    <ol v-if="showDevices">
      <li v-for="d of devices" :key="d.id">{{d.name}}<p>{{d}}</p>
        <p>COMPUTED: {{d.computed && d.computed.map(c => c.description).join(',')}}</p>
      </li>
    </ol>
    <p></p>
    <p>
    <progress id="progress" :value="progress" :max="max" style="width: 100%"/><br>{{progress}}/{{max}} ({{(progress/max*100).toFixed(1)}}%)
      {{log}}
    </p>
    <div>
      updated: {{updated}}<br>{{updatedGeofences.join(';')}}<br>
      <br>inserted: {{inserted}}<br>
      <br>ignored: {{ignored}}<br>{{ignoredGeofences.join(';')}}<br>
      <br>error: {{error}}
    </div>
    <textarea readonly v-model="lastError" style="width: 100%; height: 300px"/>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { stringify } from 'wellknown'
import Papa from 'papaparse'

export default {
  name: 'IndexPage',
  data () {
    return {
      loading: false,
      groupId: 0,
      graph: '',
      lastError: '',
      error: 0,
      max: 0,
      updated: 0,
      updatedGeofences: [],
      ignoredGeofences: [],
      inserted: 0,
      ignored: 0,
      progress: 0,
      deviceId: 0,
      userId: 0,
      expression: '',
      file: null,
      showDevices: false,
      showGroups: false,
      showGeofences: false,
      selectedGeofences: [],
      selectedGroups: [],
      log: ''
    }
  },
  computed: {
    ...mapGetters(['session', 'devices', 'geofences', 'groups', 'users', 'geofencesLength']),
    logo() {
      return `https://${window.location.hostname}/img/logos/${window.location.hostname}.png`
    }
  },
  methods: {
    safeName (name) {
      return name.replace(/[()]/g, '')
    },
    testComputed () {
      this.$axios.$post('attributes/computed/test?deviceId=' + this.deviceId, { expression: this.expression, type: 'string' })
    },
    toggleSelectedGeofence (g) {
      if (this.selectedGeofences.includes(g)) {
        this.selectedGeofences.splice(this.selectedGeofences.indexOf(g), 1)
      } else {
        this.selectedGeofences.push(g)
      }
    },
    devicesByUser () {
      this.$store.dispatch('getDevices', this.userId)
    },
    getComputed () {
      this.$store.dispatch('getComputed')
    },
    addDevice () {
      this.$store.dispatch('addDevice', prompt('Device name?'))
    },
    async removeGeofences () {
      this.loading = true
      await this.$store.dispatch('removeGeofences', this.selectedGeofences)
      this.loading = false
    },
    async removeInvalid () {
      try {
        this.loading = true
        const geofences = await this.$axios.$get('geofences')
        const toRemove = geofences.filter(g => !g.area || g.area === 'CIRCLE (0 0, 0)').map(g => g.id)
        if (toRemove.length === 0) {
          alert('No invalid found')
        } else if (confirm('Remove ' + toRemove.length + ' duplicates?')) {
          const chunk = 4000
          this.max = toRemove.length
          for (this.progress = 0; this.progress < toRemove.length; this.progress += chunk) {
            await this.$store.dispatch('removeGeofences', toRemove.slice(this.progress, this.progress + chunk))
          }
        }
      } catch (e) {
        console.error(e)
        alert((e.response && e.response.data) || e.message || e)
      }
      this.loading = false
    },
    async removeDuplicated () {
      try {
        this.loading = true
        const toRemove = []
        const geofences = await this.$axios.$get('geofences')
        geofences.forEach(g => { if (g !== geofences.find(e => e.name === g.name)) { toRemove.push(g.id) } })
        if (toRemove.length === 0) {
          alert('No duplicates found')
        } else if (confirm('Remove ' + toRemove.length + ' duplicates?')) {
          const chunk = 4000
          this.max = toRemove.length
          for (this.progress = 0; this.progress < toRemove.length; this.progress += chunk) {
            await this.$store.dispatch('removeGeofences', toRemove.slice(this.progress, this.progress + chunk))
          }
          this.progress = this.max
        }
      } catch (e) {
        console.error(e)
        alert((e.response && e.response.data) || e.message || e)
      }
      this.loading = false
    },
    addGeofence () {
      const name = prompt('Name?')
      this.file = this.$refs.file.files[0]
      const reader = new FileReader()
      reader.onload = async (res) => {
        const content = JSON.parse(res.target.result)
        for (const feature of content.features) {
          let area
          if (feature.geometry.type === 'Point') {
            area = `CIRCLE (${feature.geometry.coordinates[1].toFixed(6)} ${feature.geometry.coordinates[0].toFixed(6)}, 100)`
          } else {
            feature.geometry.coordinates = feature.geometry.coordinates.map(c => [c[1].toFixed(6), c[0].toFixed(6)])
            area = stringify(feature)
          }
          console.log(area)
          await this.$store.dispatch('addGeofence', { name, area })
        }
      }
      reader.onerror = (err) => console.log(err)
      reader.readAsText(this.file)
    },
    addGeofencesFromCSV () {
      if (!this.groupId) {
        alert('Please select group.')
        return
      }
      Papa.parse(this.$refs.csv.files[0], {
        complete: async ({ data }) => {
          this.max = data.length
          for (const fields of data) {
            this.progress++
            if (fields.length < 3) continue
            const area = `CIRCLE (${fields[1]} ${fields[2]}, ${fields[3] || 100})`
            // eslint-disable-next-line no-control-regex
            const name = fields[0].replace(/[^\x00-\x7F]/g, '')
            // eslint-disable-next-line no-control-regex
            const description = (fields[4] && fields[4].replace(/[^\x00-\x7F]/g, '')) || ''
            try {
              const geofence = this.geofences.find(g => g.name === name)
              if (!geofence) {
                const geofence = await this.$store.dispatch('addGeofence', { name, area, description })
                this.log = 'inserted'
                this.inserted++
                await this.$store.dispatch('addPermission', { groupId: this.groupId, geofenceId: geofence.id })
              } else {
                if (area !== geofence.area) {
                  await this.$store.dispatch('updateGeofence', geofence)
                  this.log = `updated ${geofence.name}`
                  this.updatedGeofences.push(geofence.name)
                  this.updated++
                } else {
                  this.log = `ignored ${geofence.name}`
                  this.ignoredGeofences.push(geofence.name)
                  this.ignored++
                }
              }
            } catch (e) {
              console.error(e)
              this.error++
              this.lastError += `${fields}\n${(e.response && e.response.data) || e.message}\n\n`
            }
          }
        }
      })
    }
  },
  async mounted () {
    this.loading = true
    await this.$store.dispatch('getUserData')
    this.loading = false
  }
}
</script>
<style>
#loader {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  width: 120px;
  height: 120px;
  margin: -76px 0 0 -76px;
  border: 16px solid #f3f3f3;
  border-radius: 50%;
  border-top: 16px solid #3498db;
  -webkit-animation: spin 2s linear infinite;
  animation: spin 2s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

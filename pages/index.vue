<template>
  <div>
    user: {{this.session && this.session.email}} {{this.session && this.session.id}}
    <br/>
    <p></p>
    {{geofences.length}} geofences:
    <button @click="showGeofences=!showGeofences">{{showGeofences?'Hide':'Show'}}</button>
    <button @click="selectedGeofences = geofences.map(g => g.id)">Select all</button>
    <ol v-if="showGeofences">
      <li v-for="d of geofences" :key="d.id" @click="toggleSelectedGeofence(d.id)"
          :style="selectedGeofences.includes(d.id)?'background-color: yellow':''">{{d.name}} {{d.attributes}}</li>
    </ol>
    <input @click="removeGeofences" :value="`Delete selected (${selectedGeofences.length})`" type="button">
    <p></p>
    <input @click="removeDuplicated" value="Delete duplicated" type="button">
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
    <vue-mermaid-string v-if="graph" :value="graph" :options="{ maxTextSize: 10000000000000 }" >
    </vue-mermaid-string>
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
    ...mapGetters(['session', 'devices', 'geofences', 'groups', 'users'])
  },
  methods: {
    safeName (name) {
      return name.replace(/[()]/g, '')
    },
    async getGraph () {
      this.devices.forEach(d => { d.group = this.groups.find(g => g.id === d.groupId) })
      const devices = this.devices.filter(d => d.group && d.group.name).map(d => `${d.id}[${this.safeName(d.name)}] --> ${d.group.id}([${
        this.safeName(d.group.name)}])`)
      this.max = this.users.length
      for (const u of this.users) {
        this.progress++
        u.groups = await this.$axios.$get('groups?userId=' + u.id)
        u.devices = await this.$axios.$get('devices?userId=' + u.id)
      }
      const userGroups = this.users.map(u => u.groups.map(g => `${g.id}([${this.safeName(g.name)}]) --- ${u.id}((${u.name}))`)).flat()
      const userDevices = this.users.filter(u => u.id !== this.session.id).map(u => u.devices.map(d => `${d.id}[${this.safeName(d.name)}] --- ${u.id}((${u.name}))`)).flat()
      return `flowchart LR\n\t${devices.join('\n\t')}\n\t${userGroups.join('\n\t')}\n\t${userDevices.join('\n\t')}`
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
      for (const g of this.selectedGeofences) {
        await this.$store.dispatch('removeGeofence', g)
      }
    },
    async removeDuplicated () {
      const toRemove = []
      this.geofences.forEach((g, i, a) => {
        if (g !== a.find(e => e.name === g.name)) {
          toRemove.push(g)
        }
      })
      console.log('found', toRemove.length, 'duplicates')
      for (const g of toRemove) {
        console.log('removing', g.name)
        await this.$store.dispatch('removeGeofence', g.id)
      }
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
    await this.$store.dispatch('getUserData')
    this.graph = await this.getGraph()
  }
}
</script>

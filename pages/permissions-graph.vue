<template>
  <div>
    <p>
      <progress id="progress" :value="progress" :max="max" style="width: 100%"/><br>{{progress}}/{{max}} ({{(progress/max*100).toFixed(1)}}%)
    </p>
    <svg>
    </svg>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import * as d3 from 'd3'

export default {
  name: 'permissions-graph',
  async mounted () {
    await this.$store.dispatch('getUserData')
    this.graph = await this.getGraph()
    this.getD3()
  },
  computed: {
    ...mapGetters(['session', 'devices', 'geofences', 'groups', 'users'])
  },
  data () {
    return {
      max: 1,
      progress: 0
    }
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
    linkArc (d) {
      const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y)
      return `
        M${d.source.x},${d.source.y}
        A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
      `
    },
    getD3 () {
      const width = 928
      const height = 600
      const suits = require('./suits.json')
      const types = Array.from(new Set(suits.map(d => d.type)))
      const nodes = Array.from(new Set(suits.flatMap(l => [l.source, l.target])), id => ({ id }))
      const links = suits.map(d => Object.create(d))
      const color = d3.scaleOrdinal(types, d3.schemeCategory10)

      const drag = simulation => {
        function dragstarted (event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        }

        function dragged (event, d) {
          d.fx = event.x
          d.fy = event.y
        }

        function dragended (event, d) {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }

        return d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended)
      }

      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('x', d3.forceX())
        .force('y', d3.forceY())

      const svg = d3.select('svg')
        .attr('viewBox', [-width / 2, -height / 2, width, height])
        .attr('width', width)
        .attr('height', height)
        .attr('style', 'max-width: 100%; height: auto; font: 12px sans-serif;')

      // Per-type markers, as they don't inherit styles.
      svg.append('defs').selectAll('marker')
        .data(types)
        .join('marker')
        .attr('id', d => `arrow-${d}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', -0.5)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5')

      const link = svg.append('g')
        .attr('fill', 'none')
        .attr('stroke-width', 1.5)
        .selectAll('path')
        .data(links)
        .join('path')
        .attr('stroke', d => color(d.type))
        .attr('marker-end', d => `url(${new URL(`#arrow-${d.type}`, location)})`)

      const node = svg.append('g')
        .attr('fill', 'currentColor')
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .call(drag(simulation))

      node.append('circle')
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .attr('r', 4)

      node.append('text')
        .attr('x', 8)
        .attr('y', '0.31em')
        .text(d => d.id)
        .clone(true).lower()
        .attr('fill', 'none')
        .attr('stroke-width', 3)

      simulation.on('tick', () => {
        link.attr('d', this.linkArc)
        node.attr('transform', d => `translate(${d.x},${d.y})`)
      })

      // invalidation.then(() => simulation.stop())

      return Object.assign(svg.node(), { scales: { color } })
    }
  }
}
</script>

<style scoped>

</style>

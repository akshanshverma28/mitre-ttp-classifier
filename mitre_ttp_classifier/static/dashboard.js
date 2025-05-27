// 1️⃣ BAR CHART
d3.json('/vuln-by-os').then(data => {
  const svg = d3.select("#barChart"),
        w   = svg.node().clientWidth,
        h   = svg.node().clientHeight,
        m   = {top:20, right:10, bottom:80, left:60},
        iw  = w - m.left - m.right,
        ih  = h - m.top  - m.bottom;

  const x = d3.scaleBand()
      .domain(data.map(d => d.os))
      .range([0, iw])
      .padding(0.1);

  const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count)])
      .nice()
      .range([ih, 0]);

  const g = svg.append("g")
      .attr("transform", `translate(${m.left},${m.top})`);

  g.selectAll("rect")
    .data(data).enter().append("rect")
      .attr("x",      d => x(d.os))
      .attr("y",      d => y(d.count))
      .attr("width",  x.bandwidth())
      .attr("height", d => ih - y(d.count))
      .attr("fill",   "#4da6ff");

  g.append("g")
    .attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
      .attr("transform", "rotate(-45)")
      .style("text-anchor","end")
      .attr("fill","#ccc");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickSize(-iw))
    .selectAll("text").attr("fill","#ccc");
});

// 2️⃣ PIE CHART + LEGEND
// 2️⃣ PIE CHART + in-SVG legend + slice-labels
d3.json('/vuln-os-proportions').then(data => {
  const svg = d3.select("#pieChart"),
        w   = svg.node().clientWidth,
        h   = svg.node().clientHeight,
        r   = Math.min(w,h)/2 - 20,
        margin = {top:20, right:120, bottom:20, left:20};

  // clear old
  svg.selectAll("*").remove();

  // color scale
  const color = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(data.map(d => d.os));

  // pie layout
  const pie = d3.pie().value(d => d.pct);
  const arc = d3.arc().innerRadius(0).outerRadius(r);

  // main group, centered but shifted left to leave room for legend on right
  const g = svg.append("g")
      .attr("transform", `translate(${w/2 - margin.right/2},${h/2})`);

  // draw slices
  const slices = g.selectAll("slice")
    .data(pie(data)).enter().append("g");

  slices.append("path")
    .attr("d", arc)
    .attr("fill", d => color(d.data.os));

  // slice labels: OS name
  slices.append("text")
    .attr("transform", d => `translate(${arc.centroid(d)})`)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .attr("fill", "#fff")
    .style("font-size", "11px")
    .text(d => d.data.os);

  // in-SVG legend to the right
  const legend = svg.append("g")
      .attr("transform", `translate(${w - margin.right + 10},${margin.top})`);

  data.forEach((d, i) => {
    const row = legend.append("g")
      .attr("transform", `translate(0, ${i * 20})`);

    row.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", color(d.os));

    row.append("text")
      .attr("x", 18)
      .attr("y", 10)
      .attr("fill", "#ccc")
      .style("font-size", "13px")
      .text(d.os);
  });
});

// 3️⃣ TECHNIQUES-PER-TACTIC BAR CHART
// ─ 3️⃣ TECHNIQUES-PER-TACTIC BAR CHART ─
d3.json('/tactics-count')
  .then(data => {
    console.log("tactics-count →", data);

    const svg = d3.select("#tacticBarChart");
    svg.selectAll("*").remove();

    if (!data.length) {
      svg.append("text")
        .attr("x", 20).attr("y", 30)
        .attr("fill", "#ccc")
        .text("No tactic data available");
      return;
    }

    const margin = { top: 20, right: 20, bottom: 40, left: 150 },
          width  = svg.node().clientWidth  - margin.left - margin.right,
          height = svg.node().clientHeight - margin.top  - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
        .domain(data.map(d => d.tactic))
        .range([0, height])
        .padding(0.1);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .nice()
        .range([0, width]);

    // Draw bars
    g.selectAll("rect")
      .data(data).enter().append("rect")
        .attr("y",      d => y(d.tactic))
        .attr("x",      0)
        .attr("height", y.bandwidth())
        .attr("width",  d => x(d.count))
        .attr("fill",   "#4da6ff");

    // Y-axis (tactic names)
    g.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text").attr("fill", "#ccc");

    // X-axis (counts)
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .selectAll("text").attr("fill", "#ccc");
  })
  .catch(err => {
    console.error("Failed to load tactics-count:", err);
  });



  

// 3️⃣ FORCE-GRAPH + SLIDER + NODE-TYPES
d3.json('/data').then(fullData => {
  // build an entity→label map
  const entityMap = new Map();
  fullData.forEach(t => {
    t.entities.forEach(([text, label]) => {
      entityMap.set(text, label);
    });
  });

  // initial slice
  let count = +d3.select("#nodeCount").property("value");
  let displayed = fullData.slice(0, count);

  const svg = d3.select("#graph"),
        W   = svg.node().clientWidth,
        H   = svg.node().clientHeight,
        g   = svg.append("g");

  function draw() {
    g.selectAll("*").remove();

    // nodes & links data
    const idSet = new Set();
    displayed.forEach(d => {
      idSet.add(d.name);
      d.entities.forEach(e => idSet.add(e[0]));
    });

    const nodes = Array.from(idSet).map(id => ({
      id,
      type: fullData.some(t => t.name === id) ? "technique" : "entity",
      label: entityMap.get(id) || null
    }));

    const links = [];
    displayed.forEach(d => {
      d.entities.forEach(e => links.push({
        source: d.name,
        target: e[0]
      }));
    });

    // simulation
    const sim = d3.forceSimulation(nodes)
      .force("link",   d3.forceLink(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(W/2, H/2));

    // draw links
    g.append("g").selectAll("line")
      .data(links).enter().append("line")
        .attr("stroke", "#555");

    // draw nodes
    g.append("g").selectAll("circle")
      .data(nodes).enter().append("circle")
        .attr("r", d => d.type === "technique" ? 8 : 5)
        .attr("fill", d => d.type === "technique" ? "#4da6ff" : "#ffa64d")
        .style("cursor", "pointer")
        .on("click", (e, d) => {
          if (d.type === "technique") showTechnique(d.id);
          else showEntity(d.id, d.label);
        })
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag",  dragged)
          .on("end",   dragended)
        );

    // draw labels
    g.append("g").selectAll("text")
      .data(nodes).enter().append("text")
        .text(d => d.id)
        .attr("font-size", 8)
        .attr("dx", 10).attr("dy", 3)
        .attr("fill", "#ccc");

    // tick
    sim.on("tick", () => {
      g.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      g.selectAll("circle")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      g.selectAll("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });
  }

  // initial draw
  draw();

  // zoom/pan
  svg.call(d3.zoom().on("zoom", e => g.attr("transform", e.transform)));

  // slider handler
  d3.select("#nodeCount").on("input", function() {
    count = +this.value;
    d3.select("#nodeCountVal").text(count);
    displayed = fullData.slice(0, count);
    draw();
  });

  // drag helpers
  function dragstarted(e,d){
    if(!e.active) e.subject.fx = d.x, e.subject.fy = d.y;
  }
  function dragged(e,d){ d.fx = e.x; d.fy = e.y; }
  function dragended(e,d){
    if(!e.active) e.subject.fx = null, e.subject.fy = null;
  }

  // 4️⃣ DETAILS PANEL
  function showTechnique(id) {
    const entry = fullData.find(t => t.name === id);
    if(!entry) return;
    const html = `
      <h3>${entry.name}</h3>
      <div><strong>Technique ID:</strong> ${entry.id}</div>
      <div><strong>Tactics:</strong> ${entry.tactics.join(", ") || "None"}</div>
      <h3>Description</h3>
      <p>${entry.description}</p>
      <h3>Extracted Entities</h3>
      <ul>
        ${entry.entities.map(e=>`<li>${e[0]} <em>(${e[1]})</em></li>`).join("")}
      </ul>
    `;
    d3.select("#details").html(html);
    document.getElementById("details-section")
            .scrollIntoView({ behavior: "smooth" });
  }

  

//   // Populate dropdown once fullData is loaded:
// fullData.forEach(entry => {
//   d3.select("#nodeSelect")
//     .append("option")
//       .attr("value", entry.id)
//       .text(`${entry.id} — ${entry.name}`);
// });

// d3.select("#nodeSubmit").on("click", () => {
//   const chosenId = select.property("value");
//   if (!chosenId) {
//     alert("Please select a Technique ID");
//     return;
//   }
//   const entry = fullData.find(t => t.id === chosenId);
//   if (entry) {
//     showDetails(entry);
    
//   }
// });



// function showDetails(entry) {
//   const html = `
//     <h3>${entry.name}</h3>
//     <div><strong>ID:</strong> ${entry.id}</div>
//     <div><strong>Sub-techniques:</strong> ${entry.subtechniques?.join(", ")||"None"}</div>
//     <div><strong>Tactics:</strong> ${entry.tactics.join(", ")||"None"}</div>
//     <div><strong>Platforms:</strong> ${entry.platforms.join(", ")||"None"}</div>
//     <div><strong>Version:</strong> ${entry.version}</div>
//     <div><strong>Created:</strong> ${entry.created}</div>
//     <div><strong>Modified:</strong> ${entry.modified}</div>
//     <h3>Description</h3>
//     <p>${entry.description}</p>
//     <h3>Extracted Entities</h3>
//     <ul>
//       ${entry.entities.map(e=>`<li>${e[0]} <em>(${e[1]})</em></li>`).join("")}
//     </ul>
//   `;
//   d3.select("#details").html(html);
//   document.getElementById("details-section")
//           .scrollIntoView({behavior:"smooth"});
// }



  function showEntity(text, label) {
    const html = `
      <h3>Entity: ${text}</h3>
      <div><strong>Type:</strong> ${label}</div>
    `;
    d3.select("#details").html(html);
    document.getElementById("details-section")
            .scrollIntoView({ behavior: "smooth" });
  }



  // ── 5️⃣ Top Data Sources by Technique Count ──
d3.json('/data-sources-count').then(data => {
  console.log('data-sources-count →', data);
  const svg = d3.select('#dataSourceChart');
  svg.selectAll('*').remove();

  if (!data.length) {
    svg.append('text')
      .attr('x', 20).attr('y', 30)
      .attr('fill', '#ccc')
      .text('No data sources available');
    return;
  }

  const margin = { top: 20, right: 20, bottom: 100, left: 200 },
        width  = svg.node().clientWidth  - margin.left - margin.right,
        height = svg.node().clientHeight - margin.top  - margin.bottom;

  const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

  // y-axis = data source names
  const y = d3.scaleBand()
      .domain(data.map(d => d.source))
      .range([0, height])
      .padding(0.1);

  // x-axis = technique counts
  const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count)])
      .nice()
      .range([0, width]);

  // draw bars
  g.selectAll('rect')
    .data(data)
    .enter().append('rect')
      .attr('y',      d => y(d.source))
      .attr('x',      0)
      .attr('height', y.bandwidth())
      .attr('width',  d => x(d.count))
      .attr('fill',   '#ffa64d');

  // y-axis labels
  g.append('g')
    .call(d3.axisLeft(y))
    .selectAll('text')
      .attr('fill', '#ccc');

  // x-axis at bottom
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll('text')
      .attr('fill', '#ccc')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end');
});
});

import d3 from 'd3';
import $ from 'jquery';


class Visualizer {

  constructor(mountNode, initialData, options){
    this.mountNode = mountNode;
    this.setInitialData(initialData);

    this.options = {
      animationSpeed: 500,
      width: 600,
      height: 400,
      arrayCellHeight: 30,
      arrayCellWidth: 40,
      treeWidth: 650,
      treeCirclesRadius: 30,
      treeLevelsVerticalPadding: 15,
      debug: false, // show indexes too
      ...(options || {})
    };
    this._focusedIndexes = {};
    this._initContainers();
  }

  setInitialData(initialData){
    this._data = initialData.map((val, i) => ({val, key: i}));
    this.activeLength = this._data.length;
  }

  _initContainers(){
    this.svgContainer = d3.select(this.mountNode)
      .append('svg')
        .attr('class', 'visualization')
        .attr('width', this.options.width)
        .attr('height', this.options.height);

    this.treeContainer = this.svgContainer.append('g')
      .attr('transform', `translate(10, ${100})`);

    this.arrayContainer = this.svgContainer.append('g')
      .attr('transform', `translate(10, ${10})`);
  }

  clearFocus(){
    this._focusedIndexes = {};
  }

  getFocused(){
    return Object.keys(this._focusedIndexes);
  }

  focus(indexes){
    indexes.forEach((i) => (this._focusedIndexes[i] = true))
  }

  swap(index1, index2){
    // swap values
    const elem1 = this._data[index1];
    this._data[index1] = this._data[index2];
    this._data[index2] = elem1;
  }

  setActiveLength(val){
    this.activeLength = val;
  }

  renderArray(animationSpeed){
    if(animationSpeed===undefined){
      animationSpeed = this.options.animationSpeed
    }

    const data = this._data;
    const gCells = this.arrayContainer.selectAll('g').data(data, d => d.key);
    const gEnter = gCells.enter().append('g');
    gEnter.append('rect');
    gEnter.append('text');
    gCells.exit().remove();

    gCells
      .attr('class', (d,i) => {
        const classes = ['array-cell'];
        if(this._focusedIndexes[i]) classes.push('focused');
        if(i >= this.activeLength) classes.push('inactive');
        return classes.join(' ');
      })
      .transition().duration(animationSpeed)
      .attr('transform', (d, i) => (`translate(${(this.options.arrayCellWidth+3)*i})`) );

    const rects = gCells.selectAll('rect')
      .transition()
        .attr('width', this.options.arrayCellWidth)
        .attr('height', this.options.arrayCellHeight)
      ;

    const text = gCells.selectAll('text')
      .transition()
      .text(d => d.val)
      .attr('x', this.options.arrayCellWidth/2)
      .attr('y', this.options.arrayCellHeight/2 + 5)
      .style("text-anchor", "middle")

      ;
  }

  renderTree(animationSpeed){
    if(animationSpeed===undefined){
      animationSpeed = this.options.animationSpeed
    }

    const circleRadius = this.options.treeCirclesRadius;
    const width = this.options.treeWidth - circleRadius*2;

    const data = this._data.slice(0, this.activeLength).map((d, i) => {
      const level = Math.ceil(Math.log2(i + 2)) - 1;
      const levelCount  = Math.pow(2, level);
      const pos = i - (levelCount - 1);
      const nodeX = width/levelCount * pos + width/levelCount/2;
      const nodeY = level * (circleRadius*2 + this.options.treeLevelsVerticalPadding);
      const parentIndex = Math.trunc((i - 1) / 2);
      return {val: d.val, key: d.key, index: i, level, pos, nodeX, nodeY, parentIndex}
    });

    const innerContEnter = this.treeContainer.selectAll('g').data([0])
      .enter().append('g')
          .attr('class', 'tree-inner-cont')
          .attr('transform', d => `translate(${circleRadius + 5}, ${circleRadius + 5})`);

    innerContEnter.append('g').attr('class', 'lines-cont');
    innerContEnter.append('g').attr('class', 'nodes-cont');
    const cont = this.treeContainer.select('g.tree-inner-cont');

    const lines = cont.select('.lines-cont').selectAll('line').data(data);

    lines.enter().append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 0);
    lines.exit().remove();

    lines
      .filter(d => d.index != 0)
      .transition().duration(animationSpeed)
        .attr('x1', d => d.nodeX)
        .attr('y1', d => d.nodeY)
        .attr('x2', d => data[d.parentIndex].nodeX)
        .attr('y2', d => data[d.parentIndex].nodeY)
        .style('stroke','black')
        .style('stroke-width', 1);

    const nodes = cont.select('.nodes-cont').selectAll('g').data(data, d => d.key);
    const gEnter = nodes.enter().append("g");
    gEnter.append('line');
    gEnter.append('circle');
    gEnter.append('text');

    nodes.exit().remove();

    nodes
      .attr('class', d => this._focusedIndexes[d.index]? 'tree-node focused': 'tree-node')
      .transition().duration(animationSpeed)
      .attr('transform', d => `translate(${d.nodeX}, ${d.nodeY})`)
    ;

    nodes.select('text')
      .transition().duration(animationSpeed)
      .text(d => {return this.options.debug ? `${d.val} (${d.index})`: d.val })
      .attr('y', 5)
      .style("text-anchor", "middle");

    nodes.select('circle')
      .transition().duration(animationSpeed)
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r",  circleRadius)
  }

  render(animationSpeed){
    this.renderArray(animationSpeed);
    this.renderTree(animationSpeed);
  }
}


class VisualizationController {

  constructor(mountNode, operationsList){
    this.mountNode = mountNode;
    this.operationsList = operationsList;

    const initOperation = operationsList[0];
    this.initialData = initOperation.data;
    this.currentOpIndex = 0;

    this._initContainers();

    this.visualizer = new Visualizer(
      this.domNode.querySelector('.visualizer-container'),  this.initialData
    );
    this.visualizer.render();

    this._fillOperationsSelector();
    $(this.opSelector).val(this.currentOpIndex);

    this._bindListeners();
    setInterval(this._afterLastOperation.bind(this), 100);
  }

  _initContainers() {
    const tpl = `
      <div class="visualization-controller">
        <div class="main-panel">
            <div class="visualizer-container"></div>
            <div class="operations-list" >
              <select multiple>
              </select>
            </div>
        </div>
        <div class="control-panel" >
            <button class="prev"> < prev </button>
            <button class="next"> next > </button>
            <button class="play"> play </button>
            <button class="reset"> reset </button>
        </div>
      </div>
    `;
    this.domNode = $(tpl).get(0);
    $(this.domNode).appendTo(this.mountNode);

    this.opSelector = $(this.domNode).find('.operations-list select').get(0)
  }

  _fillOperationsSelector(){
    d3.select(this.opSelector)
      .style('height', this.visualizer.options.height)
      .style('width', 200)
      .selectAll('option')
      .data(this.operationsList)
      .enter().append('option')
      .attr('value', (d, i) => i)
      .text((d, i) => {
        let ret = ''
        if(d.type == 'focus'){
          ret = `select nodes ${d.first_index}, ${d.second_index}`
        }
        if(d.type == 'swap'){
          ret = `swap nodes ${d.first_index} <-> ${d.second_index}`
        }
        if(d.type == 'init'){
          ret = `init [${d.data.join(', ')}]`;
        }
        if(d.type == 'change-active-length'){
          ret = `mark sored`;
        }

        return `${i}. ${ret}`;
      })
  }

  _bindListeners(){

    $(this.opSelector).on('change', ()=> {
      const opIndex = +$(event.target).find('option:selected').val();
      this._selectOperation(opIndex);
    });

    const controls = $(this.domNode).find('.control-panel');

    controls.find('button.reset').on('click', ()=> {
      this._selectOperation(0)
    });

    controls.find('button.next').on('click', ()=> {
      this._selectOperation(this.currentOpIndex + 1)
    });

    controls.find('button.prev').on('click', ()=> {
      this._selectOperation(this.currentOpIndex - 1)
    });

    const playBtn = controls.find('button.play');

    playBtn.on('click', ()=> {
      const stop = ()=>{
        clearInterval(this._playTimer);
        this._playTimer = null;
        playBtn.text('play')
      };

      if(this._playTimer){
        stop()
      }else{
        playBtn.text('pause');

        this._playTimer = setInterval(()=>{
          if(!this._playTimer || this.currentOpIndex >= this.operationsList.length - 1){
            stop();
            return
          }
          this._selectOperation(this.currentOpIndex + 1)
        }, this.visualizer.options.animationSpeed)
      }
    });
  }

  _afterLastOperation(){
    // clear focused nodes after swap operation
    if(this._lastOperation &&
       this._lastOperation.type == 'swap' &&
       (new Date() - this._lastOperationTime) >= this.visualizer.options.animationSpeed &&
       this.visualizer.getFocused().length > 0
    ){
      this.visualizer.clearFocus();
      this.visualizer.render()
    }
  }

  _makeOp(op, direction){
    if(op.type == 'swap'){
      this.visualizer.clearFocus();
      this.visualizer.focus([op.first_index, op.second_index]);
      this.visualizer.swap(op.first_index, op.second_index);
    }
    if(op.type == 'focus'){
      this.visualizer.clearFocus();
      if(direction == 'forward'){
        this.visualizer.focus([op.first_index, op.second_index])
      }
    }
    if(op.type == 'init'){
      this.visualizer.clearFocus();
      this.visualizer.setInitialData(op.data);
    }
    if(op.type == 'change-active-length'){
      this.visualizer.clearFocus();
      let step = op.step;
      if(direction == 'backward'){
        step = -step;
      }
      this.visualizer.setActiveLength(this.visualizer.activeLength + step);
    }
    this._lastOperation = op;
    this._lastOperationTime = new Date();
  }

  _jumpTo(opIndex){
    const currentOpIndex = this.currentOpIndex;

    const direction = currentOpIndex < opIndex ? 'forward' : 'backward';
    if(currentOpIndex < opIndex){
      for(let i=currentOpIndex + 1; i <= opIndex; i++){
        this._makeOp(this.operationsList[i], direction)
      }
    }else{
      for(let i=currentOpIndex; i > opIndex; i--){
        this._makeOp(this.operationsList[i], direction)
      }
      const lastOp = this.operationsList[opIndex];
      if( lastOp.type == 'focus' ){
        this._makeOp(lastOp, 'forward')
      }
    }
    this.currentOpIndex = opIndex;
  }

  _selectOperation(opIndex){
    if(opIndex < 0){
      opIndex = 0;
    }
    if(opIndex >= this.operationsList.length){
      opIndex = this.operationsList.length - 1;
    }

    const lastOpTime = this._lastOperationTime;

    $(this.opSelector).val(opIndex);
    this._jumpTo(opIndex);

    const delta = new Date() - lastOpTime;

    if( delta > this.visualizer.options.animationSpeed - 50){
      this.visualizer.render();
    }else{
      this.visualizer.render(0);
    }
  }
}


// Usage Example:

const exampleOperationsList = [
  {
    type: 'init',
    //data: [367, 949, 989, 198, 616, 992],
    data:   [1,   3,    4,   0,   2,   5],
  },
  {type: 'focus', 'first_index': 5, 'second_index': 6},
  {type: 'focus', 'first_index': 2, 'second_index': 5},
  {type:  'swap', 'first_index': 2, 'second_index': 5},
  {type: 'focus', 'first_index': 3, 'second_index': 4},
  {type: 'focus', 'first_index': 1, 'second_index': 4},
  {type: 'focus', 'first_index': 1, 'second_index': 2},
  {type: 'focus', 'first_index': 0, 'second_index': 2},
  {type:  'swap', 'first_index': 0, 'second_index': 2},
  {type: 'focus', 'first_index': 5, 'second_index': 6},
  {type: 'focus', 'first_index': 2, 'second_index': 5},
  {type:  'swap', 'first_index': 2, 'second_index': 5},
  {type:  'swap', 'first_index': 0, 'second_index': 5},
  {type:  'change-active-length', 'step': -1},
  {type: 'focus', 'first_index': 1, 'second_index': 2},
  {type: 'focus', 'first_index': 0, 'second_index': 2},
  {type:  'swap', 'first_index': 0, 'second_index': 2},
  {type:  'swap', 'first_index': 0, 'second_index': 4},
  {type:  'change-active-length', 'step': -1},
  {type: 'focus', 'first_index': 1, 'second_index': 2},
  {type: 'focus', 'first_index': 0, 'second_index': 1},
  {type:  'swap', 'first_index': 0, 'second_index': 1},
  {type: 'focus', 'first_index': 3, 'second_index': 4},
  {type: 'focus', 'first_index': 1, 'second_index': 3},
  {type:  'swap', 'first_index': 0, 'second_index': 3},
  {type:  'change-active-length', 'step': -1},
  {type: 'focus', 'first_index': 1, 'second_index': 2},
  {type: 'focus', 'first_index': 0, 'second_index': 1},
  {type:  'swap', 'first_index': 0, 'second_index': 1},
  {type:  'swap', 'first_index': 0, 'second_index': 2},
  {type:  'change-active-length', 'step': -1},
  {type: 'focus', 'first_index': 1, 'second_index': 2},
  {type: 'focus', 'first_index': 0, 'second_index': 1},
  {type:  'swap', 'first_index': 0, 'second_index': 1},
  {type:  'change-active-length', 'step': -2},
];


window.c = new VisualizationController(document.querySelector('#root'), exampleOperationsList);
window.$ = $;

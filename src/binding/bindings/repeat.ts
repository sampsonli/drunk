/// <reference path="../binding" />
/// <reference path="../../util/elem" />
/// <reference path="../../component/component" />
/// <reference path="../../template/compiler" />
/// <reference path="../../viewmodel/viewmodel" />

 
module drunk {
    
    export interface IItemDataDescriptor {
        key: string | number;
        idx: number;
        val: any;
    }
    
    let REPEAT_PREFIX = "__repeat_id";
    let counter = 0;

    let regParam = /\s+in\s+/;
    let regKeyValue = /(\w+)\s*,\s*(\w+)/;

    let RepeatBindingDefinition: IBindingDefinition = {

        isTerminal: true,
        priority: 90,

        // 初始化绑定
        init() {
            this.createCommentNodes();
            this.parseDefinition();

            this.$id = REPEAT_PREFIX + counter++;
            this.cache = {};
            this.bindingExecutor = Template.compile(this.element);
        },
        
        // 创建注释标记标签
        createCommentNodes() {
            this.startNode = document.createComment('repeat-start: ' + this.expression);
            this.endedNode = document.createComment('repeat-ended: ' + this.expression);

            elementUtil.insertBefore(this.startNode, this.element);
            elementUtil.replace(this.endedNode, this.element);
        },

        // 解析表达式定义
        parseDefinition() {
            let expression: string = this.expression;
            let parts = expression.split(regParam);

            console.assert(parts.length === 2, '错误的', config.prefix + 'repeat 表达式: ', expression);

            let params: any = parts[0];
            let key: string;
            let value: string;
            
            if (params.indexOf(',') > 0) {
                let matches = params.match(regKeyValue);
                console.assert(matches, '错误的', config.prefix + 'repeat 表达式: ', expression);
                // params = params.split(regComma);
                key = matches[2];
                value = matches[1];
            }
            else {
                value = params;
            }

            this.param = {
                key: key,
                val: value
            };

            this.expression = parts[1].trim();
        },

        // 数据更新
        update(newValue: any) {
            let data = toList(newValue);

            let last = data.length - 1;
            let isEmpty = !this.itemVms || this.itemVms.length === 0;
            let vmList = [];

            let viewModel, item, i;

            for (i = 0; i <= last; i++) {
                item = data[i];
                viewModel = vmList[i] = this.getItemVm(item, i === last);

                viewModel._isChecked = true;

                if (isEmpty) {
                    elementUtil.insertBefore(viewModel.element, this.endedNode);
                }
            }

            if (!isEmpty) {
                this.releaseVm(this.itemVms);

                let curr, el;
                
                let getPrev = (node: Node) => {
                    curr = node.previousSibling;
                    while (curr && curr.__disposed) {
                        curr = curr.previousSibling;
                    }
                    return curr;
                }

                i = data.length;
                curr = getPrev(this.endedNode);

                while (i--) {
                    viewModel = vmList[i];
                    el = viewModel.element;

                    if (el !== curr) {
                        elementUtil.insertAfter(el, curr);
                    }
                    else {
                        curr = getPrev(curr);
                    }
                }
            }

            vmList.forEach(function (viewModel) {
                viewModel._isChecked = false;

                if (!viewModel._isBinded) {
                    this.bindingExecutor(viewModel, viewModel.element);
                    viewModel._isBinded = true;
                }
            }, this);

            this.itemVms = vmList;
        },

        getItemVm(item, isLast) {
            let val = item.val;
            let isCollection = util.isObject(val) || Array.isArray(val);
            let viewModel: RepeatItem;

            if (isCollection) {
                viewModel = val[this.$id];
            }
            else {
                let list = this.cache[val];

                if (list) {
                    let i = 0;
                    viewModel = list[0];

                    while (viewModel && viewModel._isChecked) {
                        viewModel = list[++i];
                    }
                }
            }

            if (viewModel) {
                this.updateItemModel(viewModel, item, isLast);
            }
            else {
                viewModel = this.createItemVm(item, isLast, isCollection);
            }

            return viewModel;
        },

        createItemVm(item: IItemDataDescriptor, isLast: boolean, isCollection: boolean) {
            let own: IModel = {};
            let val = item.val;

            this.updateItemModel(own, item, isLast);

            let viewModel = new RepeatItem(this.viewModel, own, this.element.cloneNode(true));

            if (isCollection) {
                util.defineProperty(val, this.$id, viewModel);
                viewModel._isCollection = true;
            }
            else {
                this.cache[val] = this.cache[val] || [];
                this.cache[val].push(viewModel);
            }

            return viewModel;
        },

        updateItemModel(target: any, item: IItemDataDescriptor, isLast: boolean) {
            target.$odd = 0 === item.idx % 2;
            target.$last = isLast;
            target.$first = 0 === item.idx;

            target[this.param.val] = item.val;

            if (this.param.key) {
                target[this.param.key] = item.key;
            }
        },

        releaseVm(itemVms: RepeatItem[], force?: boolean) {
            let cache: {[id: string]: RepeatItem[]} = this.cache;
            let value = this.param.val;
            let id = this.$id;

            itemVms.forEach((viewModel: RepeatItem) => {
                if (viewModel._isChecked && !force) {
                    return;
                }

                let val = viewModel[value];

                if (viewModel._isCollection) {
                    // 移除数据对viewModel实例的引用
                    val[id] = null;
                }
                else {
                    util.removeArrayItem(cache[val], viewModel);
                }

                let element = viewModel.element;
                element.__disposed = true;
                viewModel.dispose();
                elementUtil.remove(element);
            });
        },

        release() {
            if (this.itemVms && this.itemVms.length) {
                this.releaseVm(this.itemVms, true);
            }

            elementUtil.remove(this.startNode);
            elementUtil.replace(this.element, this.endedNode);

            this.cache = null;
            this.itemVms = null;
            this.startNode = null;
            this.endedNode = null;
            this.element = null;
            this.bindingExecutor = null;
        }
    };

    Binding.register("repeat", RepeatBindingDefinition);

    /**
     * 用于repeat作用域下的子viewModel
     * @class RepeatItem
     * @constructor
     * @param {Component}   parent      父级ViewModel
     * @param {object}      ownModel    私有的数据
     * @param {HTMLElement} element     元素对象
     */
    export class RepeatItem extends Component {
        
        _isCollection: boolean;
        _isChecked: boolean;
        
        protected _models: IModel[];
        
        constructor(public parent: Component | RepeatItem, ownModel, public element) {
            super(ownModel);
            this.__inheritParentMembers();
        }
        
        /**
         * 这里只初始化私有model
         * @method __init
         * @override
         * @protected
         */
        protected __init(ownModel) {
            this.__proxyModel(ownModel);
            observable.create(ownModel);
        }
        
        /**
         * 继承父级viewModel的filter和私有model
         * @method __inheritParentMembers
         * @protected
         * @override
         */
        protected __inheritParentMembers() {
            let parent = this.parent;
            let models = (<RepeatItem>parent)._models;
            
            super.__init(parent._model);
            
            this.filter = parent.filter;
    
            if (models) {
                models.forEach((model) => {
                    this.__proxyModel(model);
                });
            }
        }
        
        /**
         * 代理指定model上的所有属性
         * @method __proxyModel
         * @protected
         */
        protected __proxyModel(model: IModel) {
            Object.keys(model).forEach((name) => {
                util.proxy(this, name, model);
            });
            
            if (!this._models) {
                this._models = [];
            }
            
            this._models.push(model);
        }
        
        /**
         * 重写代理方法,顺便也让父级viewModel代理该属性
         * @method proxy
         * @override
         */
        proxy(property: string) {
            if (util.proxy(this, name, this._model)) {
                this.parent.proxy(name);
            }
        }
        
        /**
         * 重写获取事件处理方法,忘父级查找该方法
         * @override
         * @method __getHandler
         */
        __getHandler(name: string) {
            let context: any = this;
            let handler = this[name];
    
            while (!handler && context.parent) {
                context = context.parent;
                handler = context[name];
            }
    
            if (!handler) {
                if (typeof window[name] !== 'function') {
                    throw new Error("Handler not found: " + name);
                }
    
                handler = window[name];
                context = window;
            }
    
            return (...args: any[]) => {
                return handler.apply(context, args);
            };
        }
    }

    /*
     * 把数据转成列表,如果为空则转成空数组
     */
    export function toList(target): IItemDataDescriptor[] {
        let ret: IItemDataDescriptor[] = [];

        if (Array.isArray(target)) {
            target.forEach(function (val, idx) {
                ret.push({
                    key: idx,
                    idx: idx,
                    val: val
                });
            });
        }
        else if (util.isObject(target)) {
            let idx = 0;
            let key;

            for (key in target) {
                ret.push({
                    key: key,
                    idx: idx++,
                    val: target[key]
                });
            }
        }
        else if (typeof target === 'number') {
            for (let i = 0; i < target; i++) {
                ret.push({
                    key: i,
                    idx: i,
                    val: i
                });
            }
        }

        return ret;
    }

}

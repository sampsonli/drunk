/// <reference path="../promise/promise.ts" />
/// <reference path="../viewmodel/viewModel.ts" />
/// <reference path="../template/compiler.ts" />
/// <reference path="../parser/parser.ts" />
/// <reference path="../watcher/watcher.ts" />
/// <reference path="../util/elem" />
/// <reference path="../util/util.ts" />
/// <reference path="../config/config.ts" />

module drunk {

    /**
     * 绑定更新方法接口
     * @interface IBindingUpdateAction
     * @type function
     */
    export interface IBindingUpdateAction {
        (newValue: any, oldValue: any): any;
    }

    /**
     * 绑定声明接口
     * @interface IBindingDefinition
     * @type object
     */
    export interface IBindingDefinition {
        name?: string;
        isDeepWatch?: boolean;
        isTerminal?: boolean;
        priority?: number;
        expression?: string;
        retainAttribute?: boolean;

        init?(parentViewModel?: Component, placeholder?: HTMLElement): void;
        update?(newValue: any, oldValue: any): void;
        release?(): void;
    }

    /**
     * 绑定构建函数接口
     * @interface IBindingExecutor
     * @type function
     */
    export interface IBindingExecutor {
        (viewModel: ViewModel, element: any, parentViewModel?: Component, placeHolder?: HTMLElement): void;
        isTerminal?: boolean;
        priority?: number;
    }

    export class Binding {
        
        /**
         * 是否深度监听表达式
         * @property isDeepWatch
         * @type boolean
         */
        isDeepWatch: boolean;
        
        /**
         * 是否是绑定在一个插值表达式
         * @property isInterpolate
         * @type boolean
         */
        isInterpolate: boolean;
        
        /**
         * 绑定的表达式
         * @property expression
         * @type string
         */
        expression: string;

        init: (parentViewModel?: Component, placeholder?: HTMLElement) => void;
        update: IBindingUpdateAction;
        release: () => void;

        private _isActived: boolean = true;
        private _isLocked: boolean = false;
        private _unwatch: () => void;
        private _update: (newValue: any, oldValue: any) => void;
        
        /**
         * 根据绑定的定义创建一个绑定实例，根据定义进行viewModel与DOM元素绑定的初始化、视图渲染和释放
         * @class Binding
         * @constructor
         * @param  {ViewModel}          viewModel       ViewModel实例
         * @param  {HTMLElement}        element         绑定元素
         * @param  {BindingDefinition}  definition      绑定定义
         * @param  {boolean} [descriptor.isDeepWatch]   是否深度监听
         * @param  {boolean} [descriptor.isTwowayBinding] 是否双向绑定
         */
        constructor(public viewModel: ViewModel, public element: any, descriptor) {
            util.extend(this, descriptor);
        }
        
        /**
         * 初始化绑定
         * @method initialize
         */
        initialize(parentViewModel?: Component, placeholder?: HTMLElement) {
            if (this.init) {
                this.init(parentViewModel, placeholder);
            }

            this._isActived = true;

            if (!this.update) {
                return;
            }

            let expression = this.expression;
            let isInterpolate = this.isInterpolate;
            let viewModel = this.viewModel;
            let getter = parser.parseGetter(expression, isInterpolate);

            if (!getter.dynamic) {
                // 如果只是一个静态表达式直接取值更新
                return this.update(viewModel.eval(expression, isInterpolate), undefined);
            }

            this._update = (newValue, oldValue) => {
                if (!this._isActived || this._isLocked) {
                    this._isLocked = false;
                    return;
                }
                this.update(newValue, oldValue);
            }

            this._unwatch = viewModel.watch(expression, this._update, this.isDeepWatch, true);
        }
        
        /**
         * 移除绑定并销毁
         * @method dispose
         */
        dispose(): void {
            if (!this._isActived) {
                return;
            }
            if (this.release) {
                this.release();
            }

            if (this._unwatch) {
                this._unwatch();
            }
            
            Binding.removeWeakRef(this.element, this);

            this._unwatch = null;
            this._update = null;
            this._isActived = false;

            this.element = null;
            this.expression = null;
            this.viewModel = null;
        }
        
        /**
         * 设置表达式的值到viewModel上,因为值更新会触发视图更新,会返回来触发当前绑定的update方法,所以为了避免不必要的
         * 性能消耗,这里提供加锁操作,在当前帧内设置锁定状态,发现是锁定的情况就不再调用update方法,下一帧的时候再把锁定状态取消
         * @method setValue
         * @param  {any}     value    要设置的值
         * @param  {boolean} [isLocked] 是否加锁
         */
        setValue(value: any, isLocked?: boolean): void {
            this._isLocked = !!isLocked;
            this.viewModel.setValue(this.expression, value);
        }
    }

    export module Binding {

        /**
         * 终止型绑定信息列表,每个绑定信息包含了name(名字)和priority(优先级)信息
         * @property terminalBindingDescriptors
         * @private
         * @type Array<{name: string; priority: number}>
         */
        let terminalBindingDescriptors: { name: string; priority: number }[] = [];
        
        /**
         * 终止型绑定的名称
         * @property endingNames
         * @private
         * @type Array<string>
         */
        let terminalBindings: string[] = [];
        
        let definitions: { [name: string]: IBindingDefinition } = {};

        let weakRefMap: { [id: number]: Array<Binding> } = {};
        
        /**
         * 获取元素的所有绑定实例
         * @method getAllBindingsByElement
         * @static
         * @param  {Node}  element  元素节点
         * @return {Array<Binding>}
         */
        export function getAllBindingsByElement(element: Node) {
            let id = util.uuid(element);
            let bindings = weakRefMap[id];
            
            if (bindings) {
                return bindings.slice();
            }
        }
        
        /**
         * 添加引用
         * @method setWeakRef
         * @static
         * @param  {Node}     element  元素节点
         * @param  {Binding}  binding  绑定实例
         */
        export function setWeakRef(element: Node, binding: Binding) {
            let id = util.uuid(element);
            
            if (!weakRefMap[id]) {
                weakRefMap[id] = [];
            }
            
            util.addArrayItem(weakRefMap[id], binding);
        }
        
        /**
         * 移除引用
         * @method removeWeakRef
         * @static
         * @param  {Node}     element  元素节点
         * @param  {Binding}  binding  绑定实例
         */
        export function removeWeakRef(element: Node, binding: Binding) {
            let id = util.uuid(element);
            let bindings = weakRefMap[id];
            
            if (!bindings) {
                return;
            }
            
            util.removeArrayItem(bindings, binding);
            
            if (bindings.length === 0) {
                weakRefMap[id] = null;
                Component.removeWeakRef(element);
            }
        }
        
        /**
         * 绑定创建的优先级
         * @property Priority
         * @type IPriority
         */
        export enum Priority {
            low = -100,
            high = 100,
            normal = 0,
            aboveNormal = 50,
            belowNormal = -50
        };
        
        /**
         * 根据一个绑定原型对象注册一个binding指令
         * 
         * @method define
         * @static
         * @param  {string}          name  指令名
         * @param  {function|Object} def   binding实现的定义对象或绑定的更新函数
         */
        export function define<T extends IBindingDefinition>(name: string, definition: T): void {
            definition.priority = definition.priority || Priority.normal;

            if (definition.isTerminal) {
                setTernimalBinding(name, definition.priority);
            }

            if (definitions[name]) {
                console.warn(name, "绑定原已定义为：", definitions[name]);
                console.warn("替换为", definition);
            }

            definitions[name] = definition;
        }
        
        /**
         * 根据绑定名获取绑定的定义
         * 
         * @method getDefinitionByName
         * @static
         * @param  {string}  name      绑定的名称
         * @return {BindingDefinition} 具有绑定定义信息的对象
         */
        export function getDefinintionByName(name: string): IBindingDefinition {
            return definitions[name];
        }
        
        /**
         * 获取已经根据优先级排序的终止型绑定的名称列表
         * 
         * @method getTerminalBindings
         * @static
         * @return {array}  返回绑定名称列表
         */
        export function getTerminalBindings() {
            return terminalBindings.slice();
        }
        
        /**
         * 创建viewModel与模板元素的绑定
         * 
         * @method create
         * @static
         * @param  {ViewModel}   viewModel  ViewModel实例
         * @param  {HTMLElement} element    元素
         */
        export function create(viewModel: Component, element: any, descriptor: IBindingDefinition, parentViewModel?: Component, placeholder?: HTMLElement) {
            let binding: Binding = new Binding(viewModel, element, descriptor);

            util.addArrayItem(viewModel._bindings, binding);
            Binding.setWeakRef(element, binding);
            Component.setWeakRef(element, viewModel);

            return binding.initialize(parentViewModel, placeholder);
        }
        
        /**
         * 设置终止型的绑定，根据提供的优先级对终止型绑定列表进行排序，优先级高的绑定会先于优先级的绑定创建
         * 
         * @method setEnding
         * @private
         * @static
         * @param  {string}  name      绑定的名称
         * @param  {number}  priority  绑定的优先级
         */
        function setTernimalBinding(name: string, priority: number): void {
            // 检测是否已经存在该绑定
            for (let i = 0, item; item = terminalBindingDescriptors[i]; i++) {
                if (item.name === name) {
                    item.priority = priority;
                    break;
                }
            }
            
            // 添加到列表中
            terminalBindingDescriptors.push({
                name: name,
                priority: priority
            });
            
            // 重新根据优先级排序
            terminalBindingDescriptors.sort((a, b) => b.priority - a.priority);
            
            // 更新名字列表
            terminalBindings = terminalBindingDescriptors.map(item => item.name);
        }
    }
}
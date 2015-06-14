module drunk {

    interface ICacheNode {
        prev: ICacheNode;
        next: ICacheNode;
        key: string;
        value: any;
    }
    
    /**
     * LRU Cache类
     * @module drunk.cache
     * @class Cache
     */
    export class Cache<T> {
        
        /**
         * 缓存节点的hash表
         * @property _cacheMap
         * @private
         * @type object
         */
        private _cacheMap: { [key: string]: ICacheNode } = {};
        
        /**
         * 缓存头部
         * @property _head
         * @private
         * @type ICacheNode
         */
        private _head: ICacheNode = null;
        
        /**
         * 缓存尾部
         * @property _tail
         * @private
         * @type ICacheNode
         */
        private _tail: ICacheNode = null;
        
        /**
         * 缓存容量
         * @property _capacity
         * @private
         * @type number
         */
        private _capacity: number;
        
        /**
         * 缓存节点计数
         * @property _count
         * @private
         * @type number
         */
        private _count: number = 0;

        /**
         * @constructor
         * @param  {number} capacity  容量值
         */
        constructor(capacity: number) {
            if (capacity < 1) {
                throw new Error('缓存容量必须大于0');
            }
            this._capacity = capacity;
        }
        
        /**
         * 根据key获取缓存的值
         * @method get
         * @param  {string}  key  要获取的字段
         * @return {T}
         */
        get(key: string): T {
            let cacheNode = this._cacheMap[key];
            
            if (!cacheNode) {
                return;
            }
            
            this._putToHead(cacheNode);
            
            return cacheNode.value;
        }
        
        /**
         * 根据key和value设置缓存
         * @method  set
         * @param  {string}  key   要缓存的字段
         * @param  {any}     value 要缓存的值
         */
        set(key: string, value: T) {
            let cacheNode = this._cacheMap[key];
            
            if (cacheNode) {
                cacheNode.value = value;
            }
            else if (this._count < this._capacity) {
                cacheNode = this._cacheMap[key] = {
                    prev: null,
                    next: null,
                    key: key,
                    value: value
                };
                
                this._putToHead(cacheNode);
                this._count += 1;
            }
            else {
                cacheNode = this._cacheMap[key] = {
                    prev: null,
                    next: null,
                    key: key,
                    value: value
                };
                
                this._putToHead(cacheNode);
                this._removeTail();
            }
        }
        
        /**
         * 把节点放到头部
         * @method _putToHead
         * @private
         * @param  {ICacheNode}  cacheNode  缓存节点
         */
        private _putToHead(cacheNode: ICacheNode) {
            if (cacheNode === this._head) {
                return;
            }
            
            if (cacheNode.prev != null) {
                cacheNode.prev.next = cacheNode.next;
            }
            if (cacheNode.next != null) {
                cacheNode.next.prev = cacheNode.prev;
            }
            
            if (this._tail === cacheNode) {
                this._tail = cacheNode.prev;
            }
            
            cacheNode.prev = null;
            cacheNode.next = this._head;
            
            if (this._head) {
                this._head.prev = cacheNode;
            }
            else {
                this._tail = cacheNode;
            }
            this._head = cacheNode;
        }
        
        /**
         * 移除最后一个节点
         * @method _removeTail
         * @private
         * @return  {string}  返回移除的节点的key
         */
        private _removeTail() {
            let tail = this._tail;
            
            this._tail = tail.prev;
            
            tail.prev.next = tail.next;
            tail.prev = null;
            tail.next = null;
            
            delete this._cacheMap[tail.key];
        }
    }
}
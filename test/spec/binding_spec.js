
/// <reference path="../jasmine.d.ts" />
/// <reference path="../../build/drunk.d.ts" />

describe("Binding", function () {

    var Binding = drunk.Binding;
    var element = {};

    var viewModel = new drunk.ViewModel();

    beforeEach(function () {
        viewModel = new drunk.ViewModel({
            a: 1,
            b: {
                c: {
                    d: 2
                }
            }
        });
    });

    it("register with object handler", function () {
        var handler = {};
        Binding.register("test", handler);

        expect(typeof Binding.getByName('test')).toBe("function");
    });

    it("normal binding", function (done) {
        var binding = new Binding(viewModel, element, {
            name: "test",
            expression: 'a',
            init: jasmine.createSpy("init"),
            update: jasmine.createSpy("update"),
            release: jasmine.createSpy("release")
        });

        binding.$initialize();
        binding.$execute();

        expect(binding.viewModel).toBe(viewModel);
        expect(binding.element).toBe(element);
        expect(binding.name).toBe("test");
        expect(binding._update).toBeDefined();
        expect(binding._unwatch).toBeDefined();
        expect(binding._isActived).toBe(true);
        expect(binding.init).toHaveBeenCalled();
        expect(binding.update).toHaveBeenCalledWith(1, undefined);
        expect(viewModel._watchers.a).toBeDefined();

        viewModel.a = 234;

        drunk.util.requestAnimationFrame(function () {
            expect(binding.update).toHaveBeenCalledWith(234, 1);

            binding.$dispose();

            expect(binding.release).toHaveBeenCalled();
            expect(binding.viewModel).toBe(null);
            expect(binding._isActived).toBe(false);
            expect(binding.element).toBe(null);
            expect(viewModel._watchers.a).toBeNull();
            done();
        });
    });

    it("static literal binding", function () {
        var binding = new Binding(viewModel, element, {
            name: "test",
            expression: '"a"',
            update: jasmine.createSpy("update")
        });

        binding.$initialize();
        binding.$execute();

        expect(binding.update).toHaveBeenCalledWith("a", undefined);
        expect(binding._update).toBeUndefined();
    });

    it("two way binding", function (done) {
        var binding = new Binding(viewModel, element, {
            name: "test",
            expression: 'a',
            update: jasmine.createSpy("update")
        });

        binding.$initialize();
        binding.$execute();

        expect(binding.update.calls.count()).toBe(1);

        var watcher = viewModel._watchers.a;

        spyOn(viewModel, "$setValue").and.callThrough();

        binding.$setValue(2);

        expect(viewModel.$setValue.calls.any()).toEqual(true);
        expect(viewModel.a).toBe(2);
        expect(watcher.value).toBe(1);

        drunk.util.requestAnimationFrame(function () {
            expect(watcher.value).toBe(2);
            expect(binding.update.calls.count()).toBe(1);

            viewModel.$setValue('a', 3);
            drunk.util.requestAnimationFrame(function () {
                expect(watcher.value).toBe(3);
                expect(binding.update.calls.count()).toBe(2);
                done()
            });
        });
    });

    it("deep watch", function (done) {
        var binding = new Binding(viewModel, element, {
            isDeepWatch: true,
            expression: 'b',
            update: jasmine.createSpy("update")
        });

        binding.$initialize();
        binding.$execute();

        expect(binding.update.calls.count()).toBe(1);

        viewModel.b.c.d = 23;

        drunk.util.requestAnimationFrame(function () {
            expect(binding.update.calls.count()).toBe(2);

            done();
        });
    });

    it("reuse the same watcher", function (done) {
        var binding1 = new Binding(viewModel, element, {
            expression: 'a',
            update: jasmine.createSpy()
        });
        var binding2 = new Binding(viewModel, element, {
            expression: 'a',
            update: jasmine.createSpy()
        });

        binding1.$initialize();
        binding1.$execute();
        binding2.$initialize();
        binding2.$execute();

        var watcher = viewModel._watchers.a;

        expect(watcher._actions.length).toBe(2);

        binding2.$dispose();
        viewModel.a = 2;

        expect(watcher._actions.length).toBe(1);

        drunk.util.requestAnimationFrame(function () {
            expect(binding1.update).toHaveBeenCalledWith(2, 1);

            binding1.$dispose();

            expect(watcher._actions).toBeNull();
            expect(viewModel._watchers.a).toBeNull();

            done();
        });
    });

});

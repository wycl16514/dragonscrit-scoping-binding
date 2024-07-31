Global variable and function break a hole in our sematic system together. Think about the following code :
```js
var a = "global";
{
  func showA() {
   print(a);
  }
  var a = "local";
  showA();
}
```
What could you expect showA will print out for the content of variable a, should be "global" or "local"? Currently we will print "local" but this is not correct. When the line "var a = "global";" is executed, we are in global
environment, and we add the definition of "a" into the environment. Then we enter a block because the symbol "{" then we create a local environment following the global environment. 

Then we we execute the function showA, we create another local environment following the local environment attaching to the block. The local enviroment when calling the function only add parameters of the function and 
variables inside the body of function. Since ShowA has none parameters and variable declarations insided, therefore local environment attach to showA when its called has no variable named "a". When exectuing showA, we first
search variable a in the environment object attaching to the calling of showA and find no result, then we go up one level to search the environment attaching to the local socpe and this time we find variable "a" is defined
in it with content "local" and it prints out the given content:

![scoping and binding](https://github.com/user-attachments/assets/e79bbce7-8a5b-48e6-9a49-f6b50d0773b5)


For closure, it should catch all variable values when it is defined. The solution is we should create a local environment when showA is declarated and attach the environment object to the funcDecl node. When intepreter execute
the call node, it will get the envrionment object from the funcDecl node and set its parameters and any variables declarated inside its body, and treat any variable declaration as block which means each variable will has its own
local environment object and the environment will only contain the given variable such as:

![scoping and binding](https://github.com/user-attachments/assets/b013500a-a6c3-4994-8b69-af15c5648821)

This time when intepreter executes the function of showA, the call node will use the environment object attached to the func_decl node and when looking for variable "a", it will search to the head of global environment and then
it can print the correct result. This method works but requiring many changes in the code, do we have a better methond that can keep the changes as minimun as possible? There is a technique called variable resolution, remember 
after parser creates the pasing tree, we using the tree adjustor to visit and readjust the structure of the tree.

Before we going to do the variable resolution, let's add a test case for the problem first:
```js
it("should remember variable assignment before given function is declarated", () => {
        let code = `
        var a = "global";
        {
            func showA() {
                print(a);
            }
            var a = "local";
            showA();
        }
        `
        let root = createParsingTree(code)
        let intepreter = new Intepreter()
        root.accept(intepreter)
        console = intepreter.runTime.console
        expect(console.length).toEqual(1)
        expect(console[0]).toEqual("global")
    })
```
Run the test case and make sure if fail.

Variable resolution is telling interpreter where to get the correct value of given variable, for example the following code:
```js
var a = "global";
{
    func showA() {
        print(a);
    }
    var a = "local";
    showA();
}
```
When interpreter exuected the aboved code, and when it comes to line "print(a);" the resolver will tell interpreter: "you should look at the value of a in the global environment instead of local environment". Therefore we need
to design resolver to pass such kind of info to interpreter. In order to complete this task, resolver need to visit the parsing tree before interpreter and attach special info to each variable then at later time when interpreter
visiting the parsing tree, it can use the info left by resolver to referencing the correct value for given variable,the resolving process is like following:


![scoping and binding (2)](https://github.com/user-attachments/assets/41d49156-68c6-4a7e-86db-cbd40aadf9b9)

The resolver acts like interpreter, when it visit a node which can create new scope such as block, function body, it will create an environment object like interpreter, the main difference is, it won't excute or evalute nodes,
it just visit each node in the order of the parsing tree, when it encounter any variable declaration or assignment, it just add that variable to the current environment, when it found varialbe reference, it will search the 
variable from the current env, if it can't find then it will traverse back to previous env object and if it find one contains the given variable, it will send the index of the given env object to interpreter.

When interpreter visit the same variable, it get the index of the env object and get the value of the varaible from the given env. Notice that the statment "print(a);" is in the body of function, and the resolver will visit the
body of the function before the node for 'var a = "local"', that means when resolver search the value of "a", the first local env will not have entry for variable a yet, therefore it will traverse back to the global scope and
find there is an entry for "a", then it will send the index 0 to interpreter.

When interpreter referencing variable "a" in the body of showA, it will get the env index that is 0, then it will look for value of "a" in the global env which is what we want!


The resolver only needs to leave its mark on given nodes of the parsing tree, they are:

1, block statement which introduces a new scope

2, a function declaration which is also introduces a new scope

3, variable declaration 

4, variable assignment expression.


Other nodes don't do anything special but they need to parsing they children for resolution. The resolver will have the same methods as interpreter and tree adjustor and it will take certain handling for certain nodes, add a new
file name resolver.js and add the following code:

```js

```


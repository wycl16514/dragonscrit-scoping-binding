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
            let a = "local";
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
Run the test case and make sure if fail. The problem is, showA is defined in a local block, and is called in that block, when it is called, the intepreter will create a local environment object for it, and its env is behide 
the env for the local block, since the assignment 'var a = "local";' is happend befored showA is called, therefore there is a variable a with value "local" saved in the env of the block, when showA is called, interpreter excutes
code in its body and find variable "a", but this variable is not defined in the env for the body of showA, and it loops up for the env before which is the env for the local block and find there is a variable with name "a" and 
content "local", then the interpreter will take it as the value for variable "a", the process is as following:

![scoping and binding (1)](https://github.com/user-attachments/assets/da4e100a-049d-43cc-a50f-d0bc0326e0d0)


The root of the problem is, the env for function body is only created when its called, if we can create env for function body in the parsing order instead of execution order, that is we assign env object to each node in the 
parsing tree. Each node will attached by a "current env" object, at first the "current env" is the global env, when we vist a block node, we create a new local env and the "current env" switch to this env, when we go out of
block node, we switch back to previous env, the process will be as following:

![scoping and binding](https://github.com/user-attachments/assets/185c9a32-0572-4e80-ad8b-6d9817e406a5)

And we we visit a node with an indentifier, we first seach the content of this node with its attached env, if we can't find a record for the node, then we traverse backward to previous env until we find a record and then we 
change the env attach to that node to the env that contains the given variable, the process is what we call variable resolution, let's create a file name resolve.js and implement the code as following:






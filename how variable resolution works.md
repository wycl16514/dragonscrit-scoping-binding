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

```js
import Scanner from "../scanner/token"
import RunTime from "../runtime/runtime"

export default class Resolver {
    constructor() {
        //global env
        this.currentEnv = {
            previous: null,
            env: {}
        }
        this.globalEnv = this.currentEnv

        /*
        prevent in assignment, varaible at left of = appears
        at the right of =, such as :
        var a = "outer"
        {
            var a = a;
        }
        we deem such assignment as error
        */
        this.scores = [{}]
    }

    declare = (name) => {
        if (this.scores.length === 0) {
            return
        }

        const score = this.scores[this.scores.length - 1]
        score[name] = false
    }

    define = (name) => {
        if (this.scores.length === 0) {
            return
        }

        const score = this.scores[this.scores.length - 1]
        score[name] = true
    }


    resolveLocal = (node) => {
        /*
        find the env contains variable for the given node and switch the env of the
        node to the env that contains info of the given variable
        */

        let currentEnv = node.env
        const name = node.token.lexeme
        while (currentEnv) {
            if (currentEnv.env.hasOwnProperty(name)) {
                node.env = currentEnv
                return
            }

            //traverse backward to look up given variable
            currentEnv = currentEnv.previous
        }
        //check is the variable is a function name
        if (node.env[name] === "func") {
            delete node.env[name]
            return
        }

        //given variable undefined
        throw new Error(`undefined variable with name ${name}`)
    }

    visitChildren = (node) => {
        for (const child of node.children) {
            //attach current env to each node
            child["env"] = this.currentEnv
            child.accept(this)
        }
    }

    visitRootNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitProgramNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitDeclarationRecursiveNode = (parent, node) => {
        for (const child of node.children) {
            //attach current env to each node
            child["env"] = this.currentEnv
            child.accept(this)
        }
    }

    visitVarDeclarationNode = (parent, node) => {
        this.declare(node.attributes.value)
        this.visitChildren(node)
        this.define(node.attributes.value)

        // let assignedVal = node.evalRes
        const variableName = node.attributes.value
        if (node.token.lexeme === "let") {
            //we dont't care its value we only care the variable
            //contains in the given env
            this.currentEnv.env[variableName] = ""
            node["env"] = this.currentEnv
        } else {
            this.globalEnv.env[variableName] = ""
            node["env"] = this.globalEnv
        }

    }

    visitStatementRecursiveNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitBlockNode = (parent, node) => {
        /*
        in block statement, create a new env for current block
        */
        const blockEnv = {
            previous: this.currentEnv,
            env: {}
        }
        this.currentEnv = blockEnv

        node["env"] = this.currentEnv
        //if it is body of function, fill in its params
        if (node["func_params"]) {
            const paramsNode = node["func_params"]
            const paramsList = paramsNode.attributes.value
            for (const param of paramsList) {
                this.currentEnv.env[param] = ""
            }
        }

        for (const child of node.children) {
            child["env"] = this.currentEnv
            child.accept(this)
        }
       
        //when out of the local block, remove current locan enviroment
        this.currentEnv = this.currentEnv.previous
    }

    visitStatementNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitIfStmtNode = (parent, node) => {
        /*
        resolve variables in if contion, body of if and 
        body of else
        */
        const condition = node.children[0]
        condition.accept(this)
        const ifBlock = node.children[1]
        ifBlock.accept(this)
        const elseBlock = node.children[2]
        if (elseBlock) {
            elseBlock.accept(this)
        }
    }

    visitElseStmtNode = (parent, node) => {
        this.visitChildren(node)
        //this.attachEvalResult(parent, node)
    }

    visitPrintStatementNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitExpressionNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitAssignmentNode = (parent, node) => {
        //resolve the right of =
        this.visitChildren(node)
        /*
        handle case like this
        var a = "global";
        var b = "still"
        {
             func changeA() {
                a = "it is " + b + a;
             }
             var b = "now ";
             var a = "local";
             changeA();
        }
       
        it changes the global "a" 
        */
    }

   visitLogicOrNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitLogicAndNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitContinueNode = (parent, node) => {
        
    }

    visitBreakNode = (parent, node) => {
        
    }

    visitWhileNode = (parent, node) => {
        const condition = node.children[0]
        condition.accept(this)
        const body = node.children[1]
        body.accept(this)
    }

    visitForNode = (parent, node) => {
        let forInit = null
        let forChecking = null
        let forChanging = null
        let forBlock = null
        for (const child of node.children) {
            switch (child.name) {
                case "for_init":
                    forInit = child
                    break
                case "for_checking":
                    forChecking = child
                    break
                case "for_changing":
                    forChanging = child
                    break
                case "block":
                    forBlock = child
                    break
            }
        }

        if (forInit) {
            //init the condition for the for loop
            forInit.accept(this)
        }
        if (forChecking) {
            forChecking.accept(this)
        }

        if (forChanging) {
            forChanging.accept(this)
        }

        forBlock.accept(this)
    }

    visitForInitNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitForCheckingNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitForChangingNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitEqualityNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitComparisonNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitEqualityRecursvieNode = (parent, node) => {
        //resolve left and right
        this.visitChildren(node)
        }

    visitComparisonRecursiveNode = (parent, node) => {
        this.visitChildren(node)
      
    }

    visitTermNode = (parent, node) => {
        this.visitChildren(node)
       
    }

   

    visitTermRecursiveNode = (parent, node) => {
        this.visitChildren(node)
     
    }

    visitFactorNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitFactorRecursviNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitUnaryNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitUnaryRecursiveNode = (parent, node) => {
        this.visitChildren(node)
    }



    visitPrimaryNode = (parent, node) => {
        /*
        if the primary node is grouping, we need to resolve its child
        */
        if (node.attributes.value === "grouping") {
            this.visitChildren(node)
            return
        }
        //get the value from primary node
        const token = node.token
        switch (token.token) {
            case Scanner.FUNC:
                //resolve assigned function 
                const func = node.children[0]
                func["env"] = node.env
                func.accept(this)
                break
            case Scanner.IDENTIFIER:
                const name = token.lexeme
                //search the variable defined in which env
                if (this.scores.length !== 0) {
                    const score = this.scores[this.scores.length - 1]
                    if (score[name] === false) {
                        throw new Error("can't read local variable in its owner initializer")
                    }
                }
                this.resolveLocal(node)
                break
            default:
                return
        }
    }

   
    visitCallNode = (parent, node) => {
        /*
        check following code:
        var a = "global"
        {
            func showA() {
                func changeA() {
                    a = "it is " + a;
                }
                var a = "local";
                changeA();
            }
        }
        */
        //resolve parameters
        const args = node.children[0]
        this.visitChildren(args)
    }

    visitArgumentsNode = (parent, node) => {
        // node.parent = parent
        this.visitChildren(node)
    }

    visitFuncDeclNode = (parent, node) => {
        /*
        resolve variables in function body then we can handle:
        var a = "global";
        {
            func showA() {
                print(a);
            }
            var a = "local";
            showA();
        }
        */
        //remark the function name and differentiate it from normal variable
        node.env[node["func_name"]] = "func"
        const body = node.children[1]
        //attach the body of function with its params and 
        //resolve its params with the env of the body
        body["func_params"] = node.children[0]
        body.accept(this)
    }

    visitParametersNode = (parent, node) => {
        this.visitChildren(node)
    }

    visitReturnNode = (parent, node) => {
        if (node.children.length > 0) {
            this.visitChildren(node)
        }
    }

}
```
There are somethings need to be noticed, the environment objects are chained together by using a pointer "previous", given an env object it can traverse backward by using this field. And the declare and define methods are used
to prevent a newly defined variable to initalize itself such as "var a = a + 1;". The resolveLoal methods is used to traverse the env object chain to look for value for the given variable, this is the same as we have done 
before. We are using array to chain all env objects and this time we are using the previous field in the env object.

The resolver aboved attached env object to each node in the parsing tree, it visits each node in the tree just like the parser. In run time, When Intepreter want to get the value of given variable or set the value of the given
variable, it can get the env object for the variable directly from the node.As we have seen before, we look up the env object for given variable at run time, but this time we look up the env object for the variable before 
running.

There are several methods we need to pay attention to, the visitVarDeclarationNode is where we handle variable declaration, we check the variable is declared by "let" or "var", if it is declared by "let" then we add it to
local env object, otherwise we add it to gloabl env object. Another important method is visitBlock, in this node we will going to create a new env for the new scope, we create new env object and using the "previous" field
to remember the env object and switch the current environment to a new one. When we come to the end of this method, we are going out of current scope then we discard the env object for the current scope and switch the current
environment object by the "previous" field.

In this method, we also check for one special situation that is the current block is function body or not, if it is, then we need to add the function parameters into the env object then the code in the function body can 
reference them directly. Notice that we don't care about what value of the given variable takes, we only care which env object the variable belongs to, then we can match up the env object and the node of the given variable.
Since all code in a block is child node of the block node in the parsing tree, and we set the env object of all those child nodes to the env object that is created in the visitBlockNode method.

Another important method we need to check is visitIfStmtNode, this is the root node for "if else" code block, since we are not executing the code, therefore we get the conditon block , the if block, the else block and go into
these blocks to do variable resolution. Methods like visitWhileNode and visitForNode are handling loops. in visitWhileNode we go into the node for the condition and body of while to resolve variables in them, and for 
visitForNode, we go to three expressions used for "for" and doing variable resolution inside these nodes and go to the body of "for" for variable resolution.

Finally we go into the visitPrimaryNode, this is where the job gets done, it will check the current node, if it is identifier, then it will call resolveLocal to decide which env is for this node, in resolveLocal, we first
check when the current env object contains the given identifier, if not, we traverse back to previous env to find which one contains the given identifier, when we find one, we attach that env object with the identifier node.
The other case is that the current node is a annoymous function being assigned, in this case we will go into the assigned function and do variable resolution for its parameters and variables inside its body.

The visitFuncDeclNode is the key method to handle the test case aboved. we add a record into the env objet with the name of the function as key and "func" as value to indicate the given name is for function instead of 
identifier, and we have removed the given record at code before. Here we get the body node of the function which is also a node of block, and we attach the parameters node to the node for the function body, that's why
when we in the visitBlockNode method we need to put those parameter into the given env object.

Since we change the way how we look up variable in environment, we need to change the logic for runtime as following:
```js
export default class RunTime {
    constructor() {
        //console its a string buffer to receive output from print
        this.console = []
        /*
        golbalEnv used to record the bindings for global variables
        */
        //this.globalEnv = {}

        /*
        if variables that are declared by let in the out most , then 
        it should put into global envivroment
        */
        //this.localEnv = [this.globalEnv]

        /*
        call map just like env, since we can declare function inside a block or 
        inside the body of a function
        */
        this.callMap = [{}]

        this.returned_call = undefined
    }


    getAnonymousCall = () => {
        const funcRoot = this.returned_call
        this.returned_call = undefined
        return funcRoot
    }

    addAnonymousCall = (funcRoot) => {
        this.returned_call = funcRoot
    }

    addCallMap = () => {
        this.callMap.push({})
    }

    removeCallMap = () => {
        if (this.callMap.length > 1) {
            this.callMap.pop()
        }
    }

    getFunction = (funcName) => {
        for (let i = this.callMap.length - 1; i >= 0; i--) {
            const callMap = this.callMap[i]
            if (callMap[funcName]) {
                return callMap[funcName]
            }
        }
    }

    addFunction = (funcName, funcNode) => {
        const callMap = this.callMap[this.callMap.length - 1]
        callMap[funcName] = funcNode
    }

    bindVariable = (name, value, node) => {
        let currentEnv = node.env
        while (currentEnv) {
            if (currentEnv.env.hasOwnProperty(name)) {
                break
            }

            //traverse backward to look up given variable
            currentEnv = currentEnv.previous
        }

        currentEnv.env[name] = value
    }

    getVariable = (name, node) => {
        const env = node["env"].env
        if (!env[name]) {
            //report error for undefined variable
            throw new Error(`variable with name ${name}`)
        }

        return env[name]
    }



    outputConsole = (content) => {
        //add the content to console buffer
        this.console.push(content)
    }
}
```

And finally we need to change some code in the intepreter, since the changes in it is fragmented please check the code for it.








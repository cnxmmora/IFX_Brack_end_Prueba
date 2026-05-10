import { Controller, Get } from "@nestjs/common";

@Controller({})
export class TasksController {

    @Get('/task')
    getAllTask() {
        return "Todos los datos"
    }

    @Get('/')
    getHome() {
        return "HomePage"
    }
    
}
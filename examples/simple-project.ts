import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function createAndExecuteProject() {
  try {
    console.log('Creating a new project...');
    
    const projectResponse = await axios.post(`${API_URL}/projects`, {
      name: 'Todo List Application',
      description: 'A simple todo list web application with CRUD operations',
      prd: `
# Todo List Application PRD

## Overview
Build a modern todo list application with the following features:

## Functional Requirements
1. Users can create new todo items
2. Users can mark todos as complete/incomplete
3. Users can edit existing todos
4. Users can delete todos
5. Users can filter todos by status (all, active, completed)
6. Data persists in local storage

## Technical Requirements
- Frontend: React with TypeScript
- Styling: Tailwind CSS
- State Management: React Context API
- Testing: Jest and React Testing Library
- Build Tool: Vite

## UI/UX Requirements
- Clean, minimal design
- Responsive layout for mobile and desktop
- Smooth animations for interactions
- Accessibility compliant (WCAG 2.1 AA)

## Performance Requirements
- Initial load time < 2 seconds
- Smooth 60fps interactions
- Works offline after initial load
      `
    });

    const { project, tasks } = projectResponse.data;
    console.log(`\nProject created: ${project.name} (${project.id})`);
    console.log(`Generated ${tasks.length} tasks:`);
    
    tasks.forEach((task: any, index: number) => {
      console.log(`  ${index + 1}. [${task.priority}] ${task.title} (${task.type})`);
    });

    console.log('\nExecuting high-priority tasks...');
    
    const highPriorityTasks = tasks.filter((task: any) => 
      task.priority === 'critical' || task.priority === 'high'
    );

    for (const task of highPriorityTasks) {
      console.log(`\nExecuting task: ${task.title}`);
      
      try {
        const taskResponse = await axios.post(`${API_URL}/tasks`, {
          prompt: task.description,
          type: task.type,
          priority: task.priority,
          context: {
            projectId: project.id,
            projectName: project.name,
            relatedTasks: tasks.map((t: any) => t.title)
          }
        });

        const { result } = taskResponse.data;
        console.log(`✓ Task completed by ${result.agentId}`);
        console.log(`  Duration: ${result.duration}ms`);
        
        if (result.result?.content) {
          console.log(`  Output preview: ${result.result.content.substring(0, 200)}...`);
        }
      } catch (error) {
        console.error(`✗ Task failed: ${error}`);
      }
    }

    console.log('\nChecking agent statuses...');
    const agentsResponse = await axios.get(`${API_URL}/agents`);
    const { agents } = agentsResponse.data;
    
    console.log('\nAgent Status Report:');
    agents.forEach((agent: any) => {
      console.log(`  ${agent.name}:`);
      console.log(`    - State: ${agent.status.state}`);
      console.log(`    - Tasks Completed: ${agent.status.totalTasksCompleted}`);
      console.log(`    - Success Rate: ${agent.status.successRate.toFixed(1)}%`);
      console.log(`    - Avg Response Time: ${agent.status.averageResponseTime.toFixed(0)}ms`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

async function executeSingleTask() {
  try {
    console.log('\nExecuting a single task...');
    
    const response = await axios.post(`${API_URL}/tasks`, {
      prompt: 'Write a TypeScript function that validates email addresses using regex',
      type: 'implementation',
      priority: 'medium',
      context: {
        language: 'typescript',
        requirements: 'Should handle common email formats and return boolean'
      }
    });

    const { task, result } = response.data;
    console.log(`\nTask: ${task.title}`);
    console.log(`Assigned to: ${result.agentId}`);
    console.log(`Duration: ${result.duration}ms`);
    console.log(`\nResult:`);
    console.log(result.result.content);

  } catch (error) {
    console.error('Error:', error);
  }
}

async function main() {
  console.log('Multi-Agent Orchestrator Example');
  console.log('================================\n');

  console.log('Waiting for orchestrator to be ready...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  await executeSingleTask();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  await createAndExecuteProject();
}

main().catch(console.error);
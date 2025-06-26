import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');
const DESIGNERS_FILE = path.join(process.cwd(), 'data', 'designers.json');

// Load projects from file
const loadProjects = (): any[] => {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
};

// Load designers from file
const loadDesigners = (): any[] => {
  try {
    if (fs.existsSync(DESIGNERS_FILE)) {
      const data = fs.readFileSync(DESIGNERS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading designers:', error);
    return [];
  }
};

// Save projects to file
const saveProjects = (projects: any[]) => {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error('Error saving projects:', error);
  }
};

export async function POST(request: NextRequest) {
  try {
    const projects = loadProjects();
    const designers = loadDesigners();
    
    if (projects.length === 0 || designers.length === 0) {
      return NextResponse.json(
        { error: 'No projects or designers found' },
        { status: 400 }
      );
    }

    // Distribute projects among designers
    const updatedProjects = projects.map((project, index) => {
      const designerIndex = index % designers.length;
      const assignedDesigner = designers[designerIndex];
      
      return {
        ...project,
        designerId: assignedDesigner.id,
        updatedAt: new Date().toISOString()
      };
    });

    // Save updated projects
    saveProjects(updatedProjects);

    const assignmentSummary = designers.map(designer => ({
      designerId: designer.id,
      designerName: designer.name,
      projectCount: updatedProjects.filter(p => p.designerId === designer.id).length,
      projects: updatedProjects
        .filter(p => p.designerId === designer.id)
        .map(p => ({ id: p.id, name: p.name }))
    }));

    return NextResponse.json({
      message: 'Projects successfully reassigned to designers',
      totalProjects: updatedProjects.length,
      totalDesigners: designers.length,
      assignments: assignmentSummary
    });
  } catch (error) {
    console.error('Error reassigning projects:', error);
    return NextResponse.json(
      { error: 'Failed to reassign projects' },
      { status: 500 }
    );
  }
} 
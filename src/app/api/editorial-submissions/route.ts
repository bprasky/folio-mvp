import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for editorial submissions (in production, use a database)
let editorialQueue: Array<{
  id: string;
  projectId: string;
  designerId: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}> = [];

let projects: any[] = [];

// Load projects from file system (in production, use a database)
async function loadProjects() {
  if (projects.length === 0) {
    try {
      const fs = require('fs');
      const path = require('path');
      const projectsPath = path.join(process.cwd(), 'src', 'data', 'projects.json');
      
      if (fs.existsSync(projectsPath)) {
        const projectsData = fs.readFileSync(projectsPath, 'utf8');
        projects = JSON.parse(projectsData);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }
  return projects;
}

// Save projects to file system (in production, use a database)
async function saveProjects() {
  try {
    const fs = require('fs');
    const path = require('path');
    const projectsPath = path.join(process.cwd(), 'src', 'data', 'projects.json');
    
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error('Error saving projects:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, designerId } = await request.json();

    if (!projectId || !designerId) {
      return NextResponse.json(
        { error: 'Project ID and Designer ID are required' },
        { status: 400 }
      );
    }

    // Load projects
    await loadProjects();

    // Find the project
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const project = projects[projectIndex];

    // Check if already submitted
    if (project.submittedToEditorial) {
      return NextResponse.json(
        { error: 'Project has already been submitted for editorial review' },
        { status: 400 }
      );
    }

    // Create submission entry
    const submissionId = `submission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const submission = {
      id: submissionId,
      projectId,
      designerId,
      submittedAt: new Date().toISOString(),
      status: 'pending' as const
    };

    editorialQueue.push(submission);

    // Update project with submission status
    projects[projectIndex] = {
      ...project,
      submittedToEditorial: true,
      editorialSubmissionDate: submission.submittedAt
    };

    // Save updated projects
    await saveProjects();

    return NextResponse.json({ 
      success: true, 
      submissionId,
      message: 'Project submitted for editorial review successfully' 
    });

  } catch (error) {
    console.error('Error submitting project for editorial:', error);
    return NextResponse.json(
      { error: 'Failed to submit project for editorial review' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

    // Filter submissions by status
    const filteredSubmissions = editorialQueue.filter(submission => 
      submission.status === status
    );

    // Load projects to get project details
    await loadProjects();

    // Enhance submissions with project and designer details
    const enhancedSubmissions = filteredSubmissions.map(submission => {
      const project = projects.find(p => p.id === submission.projectId);
      return {
        ...submission,
        project: project ? {
          id: project.id,
          name: project.name,
          description: project.description,
          heroImage: project.heroImage || project.images?.[0]?.url,
          category: project.category,
          designerId: project.designerId
        } : null
      };
    });

    return NextResponse.json(enhancedSubmissions);

  } catch (error) {
    console.error('Error fetching editorial submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch editorial submissions' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { submissionId, action, rejectionReason, reviewedBy } = await request.json();

    if (!submissionId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Submission ID and valid action (approve/reject) are required' },
        { status: 400 }
      );
    }

    // Find the submission
    const submissionIndex = editorialQueue.findIndex(s => s.id === submissionId);
    if (submissionIndex === -1) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const submission = editorialQueue[submissionIndex];

    // Load projects
    await loadProjects();

    // Find the project
    const projectIndex = projects.findIndex(p => p.id === submission.projectId);
    if (projectIndex === -1) {
      return NextResponse.json(
        { error: 'Associated project not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Update submission
    editorialQueue[submissionIndex] = {
      ...submission,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: now,
      reviewedBy: reviewedBy || 'admin',
      ...(action === 'reject' && rejectionReason && { rejectionReason })
    };

    // Update project
    if (action === 'approve') {
      projects[projectIndex] = {
        ...projects[projectIndex],
        isEditorialApproved: true,
        editorialApprovalDate: now
      };
    } else {
      projects[projectIndex] = {
        ...projects[projectIndex],
        isEditorialApproved: false,
        editorialRejectionReason: rejectionReason || 'No reason provided'
      };
    }

    // Save updated projects
    await saveProjects();

    return NextResponse.json({ 
      success: true, 
      message: `Project ${action === 'approve' ? 'approved' : 'rejected'} successfully` 
    });

  } catch (error) {
    console.error('Error updating editorial submission:', error);
    return NextResponse.json(
      { error: 'Failed to update editorial submission' },
      { status: 500 }
    );
  }
} 
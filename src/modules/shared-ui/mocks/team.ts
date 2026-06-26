/**
 * Team roster — mirrored from change_artwork_demo_v2.html TEAM[] array.
 */

export type TeamRole =
  | 'cs'
  | 'tl'
  | 'senior_designer'
  | 'jr_designer'
  | 'digitator'
  | 'sewout'
  | 'qc'
  | 'admin';

export type TeamStatus = 'available' | 'busy' | 'in_progress' | 'offline';

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: TeamRole;
  roleLabel: string;
  status: TeamStatus;
  jobs: number;
}

export const TEAM: TeamMember[] = [
  // Client Servicing
  { id: 'U001', name: 'Priya Sharma', initials: 'PS', role: 'cs', roleLabel: 'Client Servicing', status: 'available', jobs: 2 },
  { id: 'U002', name: 'Rohan Mehta', initials: 'RM', role: 'cs', roleLabel: 'Client Servicing', status: 'busy', jobs: 4 },
  { id: 'U010', name: 'Nisha Kapoor', initials: 'NK', role: 'cs', roleLabel: 'Client Servicing', status: 'available', jobs: 3 },
  // Team Lead
  { id: 'U003', name: 'Ankit Verma', initials: 'AV', role: 'tl', roleLabel: 'Team Lead', status: 'available', jobs: 0 },
  // Senior Designers
  { id: 'U004', name: 'Kavya Reddy', initials: 'KR', role: 'senior_designer', roleLabel: 'Senior Designer', status: 'busy', jobs: 2 },
  { id: 'U005', name: 'Arjun Patel', initials: 'AP', role: 'senior_designer', roleLabel: 'Senior Designer', status: 'available', jobs: 1 },
  { id: 'U011', name: 'Sneha Joshi', initials: 'SJ', role: 'senior_designer', roleLabel: 'Senior Designer', status: 'in_progress', jobs: 3 },
  { id: 'U012', name: 'Vikram Singh', initials: 'VS', role: 'senior_designer', roleLabel: 'Senior Designer', status: 'available', jobs: 1 },
  { id: 'U013', name: 'Pooja Iyer', initials: 'PI', role: 'senior_designer', roleLabel: 'Senior Designer', status: 'busy', jobs: 2 },
  { id: 'U014', name: 'Karthik Balan', initials: 'KB', role: 'senior_designer', roleLabel: 'Senior Designer', status: 'available', jobs: 0 },
  // Junior Designers
  { id: 'U006', name: 'Rahul Nair', initials: 'RN', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'in_progress', jobs: 1 },
  { id: 'U007', name: 'Meena Das', initials: 'MD', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'available', jobs: 0 },
  { id: 'U015', name: 'Aisha Khan', initials: 'AK', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'in_progress', jobs: 2 },
  { id: 'U016', name: 'Dev Sharma', initials: 'DS', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'available', jobs: 1 },
  { id: 'U017', name: 'Tanvi Rao', initials: 'TR', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'busy', jobs: 3 },
  { id: 'U018', name: 'Faisal Ahmed', initials: 'FA', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'available', jobs: 0 },
  { id: 'U019', name: 'Ritika Gupta', initials: 'RG', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'in_progress', jobs: 1 },
  { id: 'U020', name: 'Siddharth Rao', initials: 'SR', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'available', jobs: 2 },
  { id: 'U021', name: 'Lakshmi Pillai', initials: 'LP', role: 'jr_designer', roleLabel: 'Junior Designer', status: 'busy', jobs: 1 },
  // Digitator
  { id: 'U030', name: 'Sanjay Kumar', initials: 'SK', role: 'digitator', roleLabel: 'Digitizor', status: 'available', jobs: 2 },
  { id: 'U031', name: 'Renu Iyer', initials: 'RI', role: 'digitator', roleLabel: 'Digitizor', status: 'in_progress', jobs: 1 },
  // Sewout
  { id: 'U040', name: 'Vinay Kumar', initials: 'VK', role: 'sewout', roleLabel: 'Sewout', status: 'available', jobs: 1 },
  // QC
  { id: 'U008', name: 'Suresh Kumar', initials: 'SK', role: 'qc', roleLabel: 'QC Reviewer', status: 'available', jobs: 3 },
  { id: 'U024', name: 'Divya Menon', initials: 'DM', role: 'qc', roleLabel: 'QC Reviewer', status: 'busy', jobs: 2 },
  { id: 'U025', name: 'Harish Babu', initials: 'HB', role: 'qc', roleLabel: 'QC Reviewer', status: 'available', jobs: 1 },
  // Admin
  { id: 'U009', name: 'Deepa Nair', initials: 'DN', role: 'admin', roleLabel: 'Admin', status: 'available', jobs: 0 },
];

export const byRole = (role: TeamRole) => TEAM.filter((m) => m.role === role);

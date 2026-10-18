import type { AlumniProfileView, StudentProfileView } from "../services/profiles";

/**
 * Safe projections of profiles for OTHER members (and admins). Anything private is left out by
 * construction: capacity, the pause switch, phone, email and the password hash never appear here.
 */

export function publicAlumniProfile(view: AlumniProfileView) {
  const { profile } = view;
  return {
    id: view.user.id,
    name: view.user.name,
    headline: profile.headline,
    bio: profile.bio,
    currentTitle: profile.currentTitle,
    currentCompany: profile.currentCompany,
    industry: profile.industry,
    yearsExperience: profile.yearsExperience,
    city: profile.city,
    workMode: profile.workMode,
    department: profile.department,
    degree: profile.degree,
    graduationYear: profile.graduationYear,
    helpTypes: profile.helpTypes,
    linkedinUrl: profile.linkedinUrl,
    skills: view.skills,
    experiences: view.experiences,
    educations: view.educations,
  };
}

export function publicStudentProfile(view: StudentProfileView) {
  const { profile } = view;
  return {
    id: view.user.id,
    name: view.user.name,
    headline: profile.headline,
    bio: profile.bio,
    department: profile.department,
    degree: profile.degree,
    currentYear: profile.currentYear,
    graduationYear: profile.graduationYear,
    city: profile.city,
    targetRoles: profile.targetRoles,
    targetCompanies: profile.targetCompanies,
    interestedDomains: profile.interestedDomains,
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    portfolioUrl: profile.portfolioUrl,
    skills: view.skills,
    experiences: view.experiences,
    educations: view.educations,
  };
}

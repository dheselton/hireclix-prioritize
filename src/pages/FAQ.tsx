import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Where can I find one-pagers for our integrations?",
    answer: "One-pagers are available in the Docs section. Use the search bar and filter by the 'one-pager' tag to find all integration one-pagers quickly. You can also check the specific integration card in the Integrations section for direct documentation links.",
  },
  {
    question: "How do I add a new customer to the system?",
    answer: "Click the 'Quick Add' button in the top navigation bar and select 'Add Customer', or navigate to the Customers page and click the 'Add Customer' button. Fill in the required fields including customer name, type (Career Site or JobFlow SEO), ATS platform, and other relevant details.",
  },
  {
    question: "How can I request a new integration or feature?",
    answer: "To request a new integration, contact the Engineering Team via the Admin section. Include details about the ATS or service, required capabilities, expected timeline, and business justification. Integration requests are prioritized based on customer demand and technical feasibility.",
  },
  {
    question: "What is Client-First and why do we use it?",
    answer: "Client-First is a design and development methodology that emphasizes semantic naming, component reusability, and scalable architecture. We use it to maintain consistency across all career sites, reduce technical debt, and enable faster development cycles. Check the Design System page for more details and guidelines.",
  },
  {
    question: "Who owns ATS integrations and how are they maintained?",
    answer: "The Engineering Team owns and maintains all ATS integrations. Each integration has a designated owner listed in the integration details. Integration health is monitored continuously, and updates are documented in the integration's change log. For support or issues, contact the integration owner or Engineering Team.",
  },
  {
    question: "How do I track the status of a customer project?",
    answer: "Navigate to the Customers page and use the status filter to view customers by their current state (Prospect, In Progress, Live, or Paused). Click on any customer row to view detailed information including go-live dates, associated integrations, recent activity, and project notes.",
  },
  {
    question: "What's the difference between Career Site and JobFlow SEO customers?",
    answer: "Career Site customers have full custom career site implementations with job listings, applications, and employer branding. JobFlow SEO customers use our SEO optimization service for their existing ATS-hosted job pages to improve search engine visibility and organic traffic.",
  },
  {
    question: "How often is integration health checked?",
    answer: "Integration health is monitored continuously through automated health checks and manual reviews. Status updates appear in the Recent Activity feed. Critical issues trigger immediate notifications to the Engineering Team and affected customer owners.",
  },
];

export default function FAQ() {
  return (
    <div className="w-full max-w-[1000px] mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground">
          Common questions about customers, integrations, and workflows
        </p>
      </div>

      <Card className="glass-card p-6">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="accordion-item">
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <Card className="glass-card p-6 bg-gradient-hero">
        <h3 className="font-bold text-lg mb-2">Can't find what you're looking for?</h3>
        <p className="text-muted-foreground mb-4">
          If you have a question that's not covered here, reach out to your team lead or
          check the Docs section for more detailed guides and playbooks.
        </p>
      </Card>
    </div>
  );
}

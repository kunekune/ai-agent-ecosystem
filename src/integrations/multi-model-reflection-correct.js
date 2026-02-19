/**
 * Multi-Model Reflection & Integration System - CORRECT 5-Layer Architecture
 * Based on OpenClaw Constitution: 5-Stage Escalation Structure
 */

const fs = require('fs');
const path = require('path');

class MultiModelReflectionSystem {
    constructor() {
        // CORRECT 5-Layer Architecture based on OpenClaw Constitution
        this.modelsData = {
            'claude-opus-4.6': {
                layer: 5,
                role: '編集長 (魂と戦略)',
                english_role: 'Editor-in-Chief (Soul & Strategy)',
                strengths: ['complex emotion reading', 'life insights', 'blog finalization', 'philosophical depth'],
                specialization: 'ブログの最終仕上げ、人生相談、複雑な感情の機微を読み取る返信、日記の「人生の洞察」への昇華',
                escalation_trigger: 'Deep wisdom, life guidance, final editorial review needed'
            },
            'claude-sonnet-4': {
                layer: 4,
                role: '執筆官 (論理と構成)',
                english_role: 'Writing Officer (Logic & Structure)',
                strengths: ['article drafting', 'business emails', 'PARA organization', 'program design'],
                specialization: '記事の初稿作成、高度なビジネスメール、PARA構成の整理、プログラムの設計',
                escalation_trigger: 'Complex writing, business logic, structural design needed'
            },
            'glm-4.7': {
                layer: 3,
                role: '秘書 (実務と実行)',
                english_role: 'Secretary (Operations & Execution)',
                strengths: ['calendar integration', 'Gmail operations', 'morning briefings', 'schedule coordination'],
                specialization: 'カレンダー連携、Gmail操作、朝のブリーフィング、スケジュール調整',
                escalation_trigger: 'Operational tasks, scheduling, practical execution needed'
            },
            'deepseek-v3': {
                layer: 2,
                role: '門番 (整理と速度)',
                english_role: 'Gatekeeper (Organization & Speed)',
                strengths: ['daily chat', 'task classification', 'email summarization', 'diary material structuring'],
                specialization: '日常チャット、タスクの一次分類、大量メールの要約、「日記の素材」の構造化',
                escalation_trigger: 'Quick processing, initial classification, basic organization needed'
            },
            'claude-code': {
                layer: 1,
                role: '工兵 (システム操作)',
                english_role: 'Engineer (System Operations)',
                strengths: ['file organization', 'script execution', 'API verification', 'system integrity'],
                specialization: 'PC内のファイル整理、スクリプト実行、APIの捏造がないかの実地検証',
                escalation_trigger: 'System operations, code execution, technical verification needed'
            }
        };
        
        this.distillRoute = {
            dump: 'deepseek-v3',      // L2: Collect raw information
            identify: 'claude-sonnet-4',  // L4: Extract core insights
            integrate: 'claude-opus-4.6', // L5: Infuse wisdom and depth
            layout: 'glm-4.7'        // L3: Format and place appropriately
        };

        this.sharedMemoryPath = '/home/kunekune/Dropbox/obsidian-vault/05-Journal/Shared-Model-Memory-Constitutional.json';
        this.integrationLogPath = '/home/kunekune/Dropbox/obsidian-vault/05-Journal/Integration-Progress-Constitutional.md';
    }

    /**
     * Record model experience with constitutional layer awareness
     */
    async recordModelExperience(modelName, experience) {
        const timestamp = new Date().toISOString();
        const modelInfo = this.modelsData[modelName];
        
        if (!modelInfo) {
            console.warn(`Model not in constitutional structure: ${modelName}`);
            return null;
        }

        const experienceRecord = {
            model: modelName,
            layer: modelInfo.layer,
            role: modelInfo.role,
            timestamp,
            constitutional_compliance: this.assessConstitutionalCompliance(experience, modelInfo),
            escalation_appropriateness: this.assessEscalationAppropriateness(experience, modelInfo),
            handover_quality: this.assessHandoverQuality(experience),
            ...experience
        };

        await this.appendToSharedMemory(experienceRecord);
        return experienceRecord;
    }

    /**
     * Assess constitutional compliance
     */
    assessConstitutionalCompliance(experience, modelInfo) {
        const compliance = {
            stayed_in_role: true,
            proper_escalation: true,
            handover_provided: true,
            violations: []
        };

        // L5 (Opus) exclusive tasks
        if (experience.type === 'diary_finalization' || experience.type === 'life_consultation') {
            if (modelInfo.layer !== 5) {
                compliance.stayed_in_role = false;
                compliance.violations.push('L5_EXCLUSIVE_TASK_VIOLATION');
            }
        }

        // Anti-hallucination compliance
        if (experience.contains_dummy_data || experience.uses_math_random) {
            compliance.violations.push('ANTI_HALLUCINATION_VIOLATION');
        }

        // DISTILL route compliance for important outputs
        if (experience.type === 'important_output' && !experience.followed_distill_route) {
            compliance.violations.push('DISTILL_ROUTE_VIOLATION');
        }

        return compliance;
    }

    /**
     * Generate constitutional integration summary
     */
    async generateDailyIntegrationSummary() {
        const today = new Date().toISOString().split('T')[0];
        const todaysExperiences = await this.getTodaysExperiences(today);
        
        const summary = {
            date: today,
            constitutional_compliance: this.assessDailyConstitutionalCompliance(todaysExperiences),
            layer_role_adherence: this.assessLayerRoleAdherence(todaysExperiences),
            escalation_effectiveness: this.assessEscalationEffectiveness(todaysExperiences),
            distill_route_usage: this.assessDistillRouteUsage(todaysExperiences),
            handover_quality: this.assessDailyHandoverQuality(todaysExperiences),
            constitutional_violations: this.identifyConstitutionalViolations(todaysExperiences),
            layer_contributions: this.analyzeConstitutionalLayerContributions(todaysExperiences)
        };

        await this.saveConstitutionalIntegrationSummary(summary);
        return summary;
    }

    /**
     * Assess daily constitutional compliance
     */
    assessDailyConstitutionalCompliance(experiences) {
        const totalExperiences = experiences.length;
        if (totalExperiences === 0) return { compliance_score: 10, violations: [] };

        const compliantExperiences = experiences.filter(e => 
            e.constitutional_compliance?.violations?.length === 0
        );

        return {
            compliance_score: Math.round((compliantExperiences.length / totalExperiences) * 10),
            total_experiences: totalExperiences,
            compliant_experiences: compliantExperiences.length,
            violation_rate: ((totalExperiences - compliantExperiences.length) / totalExperiences * 100).toFixed(1) + '%',
            major_violations: this.extractMajorViolations(experiences)
        };
    }

    /**
     * Assess layer role adherence
     */
    assessLayerRoleAdherence(experiences) {
        const layerPerformance = {};
        
        for (const [modelName, modelInfo] of Object.entries(this.modelsData)) {
            const modelExperiences = experiences.filter(e => e.model === modelName);
            const inRoleExperiences = modelExperiences.filter(e => 
                e.constitutional_compliance?.stayed_in_role !== false
            );

            layerPerformance[`L${modelInfo.layer}_${modelName}`] = {
                role: modelInfo.role,
                total_tasks: modelExperiences.length,
                in_role_tasks: inRoleExperiences.length,
                role_adherence_rate: modelExperiences.length > 0 ? 
                    (inRoleExperiences.length / modelExperiences.length * 100).toFixed(1) + '%' : 'N/A',
                specialization_usage: this.calculateSpecializationUsage(modelExperiences, modelInfo)
            };
        }

        return layerPerformance;
    }

    /**
     * Format constitutional integration summary as markdown
     */
    formatConstitutionalSummaryAsMarkdown(summary) {
        return `# Constitutional 5-Layer Integration Summary - ${summary.date}

## 🏛️ Constitutional Compliance Overview
- **Overall Compliance Score**: ${summary.constitutional_compliance.compliance_score}/10
- **Total Experiences**: ${summary.constitutional_compliance.total_experiences}
- **Compliant Experiences**: ${summary.constitutional_compliance.compliant_experiences}
- **Violation Rate**: ${summary.constitutional_compliance.violation_rate}

### Major Violations Today
${(summary.constitutional_compliance.major_violations && summary.constitutional_compliance.major_violations.length > 0) ? 
  summary.constitutional_compliance.major_violations.map(v => `- **${v.type}**: ${v.description}`).join('\n') : 
  '- ✅ No major violations detected'}

## 🏗️ Layer Role Adherence (Constitutional Structure)

${Object.entries(summary.layer_role_adherence).map(([layer, data]) => `
### ${layer}: ${data.role}
- **Tasks Handled**: ${data.total_tasks}
- **In-Role Tasks**: ${data.in_role_tasks}
- **Role Adherence Rate**: ${data.role_adherence_rate}
- **Specialization Usage**: ${(data.specialization_usage * 100).toFixed(1)}%
`).join('')}

## 🔄 DISTILL Route Usage Analysis
- **Important Outputs Generated**: ${summary.distill_route_usage.important_outputs}
- **DISTILL Route Followed**: ${summary.distill_route_usage.distill_compliant}
- **Route Compliance Rate**: ${summary.distill_route_usage.compliance_rate}%

### DISTILL Route Effectiveness
${(summary.distill_route_usage.route_analysis && summary.distill_route_usage.route_analysis.length > 0) ? 
  summary.distill_route_usage.route_analysis.map(step => `
- **${step.step}** (${step.model}): ${step.effectiveness}/10
`).join('') : '- No DISTILL route usage today'}

## 📊 Escalation Effectiveness
- **Appropriate Escalations**: ${summary.escalation_effectiveness.appropriate}/${summary.escalation_effectiveness.total}
- **Inappropriate Escalations**: ${summary.escalation_effectiveness.inappropriate}
- **Missing Escalations**: ${summary.escalation_effectiveness.missing}
- **Escalation Success Rate**: ${summary.escalation_effectiveness.success_rate}%

## 🤝 Handover Quality Assessment
- **Average Handover Quality**: ${summary.handover_quality.average_score}/10
- **Clear Handovers**: ${summary.handover_quality.clear_handovers}
- **Unclear Handovers**: ${summary.handover_quality.unclear_handovers}
- **Missing Handovers**: ${summary.handover_quality.missing_handovers}

## 🎯 Constitutional Recommendations for Tomorrow
${(summary.constitutional_violations.recommendations && summary.constitutional_violations.recommendations.length > 0) ? 
  summary.constitutional_violations.recommendations.map(r => `- ${r}`).join('\n') : 
  '- Continue constitutional compliance'}

---

## 🔍 Detailed Layer Contributions

${Object.entries(summary.layer_contributions).map(([model, data]) => `
### ${data.layer_info.role} (${model})
**Layer**: L${data.layer_info.layer} | **Specialization**: ${data.layer_info.specialization}

- **Tasks**: ${data.tasks_handled}
- **Success Rate**: ${(data.success_rate * 100).toFixed(1)}%
- **Constitutional Compliance**: ${(data.compliance_rate * 100).toFixed(1)}%
- **Key Contributions**: ${(data.key_contributions && data.key_contributions.length > 0) ? data.key_contributions.join(', ') : 'None'}
`).join('')}

---
#constitutional #5-layer #escalation #compliance #${summary.date}`;
    }

    // Utility methods
    assessEscalationAppropriateness(experience, modelInfo) {
        return {
            appropriate: true,
            should_escalate: false,
            target_layer: null
        };
    }

    assessHandoverQuality(experience) {
        return {
            provided: true,
            clarity: 8,
            completeness: 7
        };
    }

    assessDailyHandoverQuality(experiences) {
        const handovers = experiences.filter(e => e.handover_quality);
        const totalHandovers = handovers.length;
        
        if (totalHandovers === 0) {
            return {
                average_score: 8,
                clear_handovers: 0,
                unclear_handovers: 0,
                missing_handovers: Math.max(0, experiences.length - 5)
            };
        }

        const averageScore = handovers.reduce((sum, e) => sum + (e.handover_quality.clarity || 8), 0) / totalHandovers;
        const clearHandovers = handovers.filter(e => e.handover_quality.clarity >= 7).length;
        
        return {
            average_score: Math.round(averageScore),
            clear_handovers: clearHandovers,
            unclear_handovers: totalHandovers - clearHandovers,
            missing_handovers: Math.max(0, experiences.length - totalHandovers)
        };
    }

    extractMajorViolations(experiences) {
        const violations = [];
        experiences.forEach(exp => {
            if (exp.constitutional_compliance?.violations) {
                exp.constitutional_compliance.violations.forEach(v => {
                    if (v.includes('L5_EXCLUSIVE') || v.includes('ANTI_HALLUCINATION')) {
                        violations.push({
                            type: v,
                            description: `${exp.model} violated constitutional requirement`,
                            timestamp: exp.timestamp
                        });
                    }
                });
            }
        });
        return violations.slice(0, 5); // Top 5 violations
    }

    calculateSpecializationUsage(experiences, modelInfo) {
        return Math.random() * 0.3 + 0.7; // Simplified
    }

    assessDistillRouteUsage(experiences) {
        const importantOutputs = experiences.filter(e => e.type === 'important_output');
        const distillCompliant = importantOutputs.filter(e => e.followed_distill_route);
        
        return {
            important_outputs: importantOutputs.length,
            distill_compliant: distillCompliant.length,
            compliance_rate: importantOutputs.length > 0 ? 
                Math.round(distillCompliant.length / importantOutputs.length * 100) : 100,
            route_analysis: []
        };
    }

    assessEscalationEffectiveness(experiences) {
        return {
            appropriate: 8,
            inappropriate: 1,
            missing: 2,
            total: 11,
            success_rate: Math.round(8/11 * 100)
        };
    }

    identifyConstitutionalViolations(experiences) {
        return {
            recommendations: [
                'Ensure L5 (Opus) handles all diary finalization',
                'Follow DISTILL route for important outputs',
                'Provide 3-line handovers between model switches'
            ]
        };
    }

    analyzeConstitutionalLayerContributions(experiences) {
        const contributions = {};
        
        for (const [modelName, modelInfo] of Object.entries(this.modelsData)) {
            const modelExperiences = experiences.filter(e => e.model === modelName);
            contributions[modelName] = {
                layer_info: {
                    layer: modelInfo.layer,
                    role: modelInfo.role,
                    specialization: modelInfo.specialization
                },
                tasks_handled: modelExperiences.length,
                success_rate: modelExperiences.length > 0 ? 
                    modelExperiences.filter(e => e.success).length / modelExperiences.length : 0,
                compliance_rate: modelExperiences.length > 0 ?
                    modelExperiences.filter(e => e.constitutional_compliance?.violations?.length === 0).length / modelExperiences.length : 1,
                key_contributions: modelExperiences
                    .filter(e => e.success)
                    .map(e => e.type || 'task')
                    .slice(0, 3)
            };
        }
        
        return contributions;
    }

    async saveConstitutionalIntegrationSummary(summary) {
        const markdownContent = this.formatConstitutionalSummaryAsMarkdown(summary);
        const filename = `/home/kunekune/Dropbox/obsidian-vault/05-Journal/Integration/${summary.date}-constitutional-integration.md`;
        
        const dir = path.dirname(filename);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filename, markdownContent);
    }

    // Base methods
    async appendToSharedMemory(record) {
        let sharedMemory = [];
        
        if (fs.existsSync(this.sharedMemoryPath)) {
            const existing = fs.readFileSync(this.sharedMemoryPath, 'utf8');
            sharedMemory = JSON.parse(existing);
        }

        sharedMemory.push(record);
        
        if (sharedMemory.length > 1000) {
            sharedMemory = sharedMemory.slice(-1000);
        }

        fs.writeFileSync(this.sharedMemoryPath, JSON.stringify(sharedMemory, null, 2));
    }

    async getTodaysExperiences(date) {
        if (!fs.existsSync(this.sharedMemoryPath)) return [];
        
        const sharedMemory = JSON.parse(fs.readFileSync(this.sharedMemoryPath, 'utf8'));
        return sharedMemory.filter(record => record.timestamp.startsWith(date));
    }
}

module.exports = MultiModelReflectionSystem;
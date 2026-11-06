import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["ai", "user"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    score: {
      type: Number,
    },

    feedback: {
      type: String,
    },

    // Agent metadata
    agentStep: {
      type: String,
    },

    topicChosen: {
      type: String,
    },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Easier", "Same", "Harder"],
    },

    agentReasoning: {
      type: String,
    },

    specificMistake: {
      type: String,
    },

    suggestedImprovement: {
      type: String,
    },
  },
  { timestamps: true }
);


const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Analysis",
    },

    researchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Research",
    },

    jobRole: {
      type: String,
      required: true,
    },

    company: {
      type: String,
      default: "",
    },

    resumeText: {
      type: String,
    },

    messages: [messageSchema],

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },

    overallScore: {
      type: Number,
    },


    // =====================================================
    // INTERVIEW TYPE
    // =====================================================

    interviewType: {
      type: String,
      enum: [
        "dsa_coding",
        "system_design",
        "technical_behavioral",
        "full_company_sim",
      ],
      default: "technical_behavioral",
    },


    // =====================================================
    // PRACTICE MODE
    // =====================================================

    practiceMode: {
      type: String,
      enum: [
        "company_specific",
        "resume_deep_dive",
        "quick_15min",
        "pressure",
        "standard",
      ],
      default: "standard",
    },


    // =====================================================
    // CANDIDATE LEVEL
    // =====================================================

    candidateLevel: {
      type: String,
      enum: [
        "intern",
        "fresher",
        "sde1",
        "sde2",
        "senior",
      ],
      default: "fresher",
    },


    // =====================================================
    // FULL COMPANY SIMULATION
    // =====================================================

    currentRound: {
      type: Number,
      default: 0,
    },

    totalRounds: {
      type: Number,
      default: 1,
    },

    roundResults: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],


    // =====================================================
    // AGENT STATE
    // =====================================================

    agentState: {

      companyPatterns: {
        type: mongoose.Schema.Types.Mixed,
      },

      assessment: {
        type: mongoose.Schema.Types.Mixed,
      },

      scores: {
        type: [Number],
        default: [],
      },

      questionCount: {
        type: Number,
        default: 0,
      },

      currentQuestion: {
        type: String,
        default: "",
      },

      weakAreasIdentified: {
        type: [String],
        default: [],
      },

      strongAreas: {
        type: [String],
        default: [],
      },

      readinessScore: {
        type: Number,
      },

      nextSessionFocus: {
        type: [String],
        default: [],
      },

      existingPatterns: {
        type: mongoose.Schema.Types.Mixed,
      },


      // ===================================================
      // TOPIC TRACKING
      // ===================================================

      topicsCovered: {
        type: [String],
        default: [],
      },

      topicAttempts: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      currentTopic: {
        type: String,
        default: "",
      },

      questionsPerTopic: {
        type: Number,
        default: 0,
      },


      // ===================================================
      // TOPIC CONFIGURATION
      // ===================================================

      allowedTopics: {
        type: [String],
        default: [],
      },

      excludedTopics: {
        type: [String],
        default: [],
      },

      sessionDuration: {
        type: Number,
        default: 30,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Interview", interviewSchema);
class ModeSelector:
    def select_mode(self, request_text):
        # Implement more sophisticated mode selection logic
        words = request_text.split()
        if len(words) < 10:
            return "Direct Response"
        elif len(words) < 30:
            return "Planner"
        else:
            return "Multi-Agent"
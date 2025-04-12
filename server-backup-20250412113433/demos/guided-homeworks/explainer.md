# Guided Homeworks

Traditional homework is dead. Students can copy almost any PDF homework assignment into ChatGPT and get a passing-grade response in minutes. However, commercially available AIs are not yet sophisticated enough to log into a chatbot environment and speak as a student. Thus, embedding a homework assignment in a chatbot makes it largely AI-proof (for now). 

Here is an AI homework assignment used in Rob's data analytics class. It's a problem set comprising 11 "practice problems," where the AI is encouraged to help, and four "trial problems," where the AI is instructed to take a hands-off approach. Couching these problems in an AI changes the student experience from a slog through a list of exercises to a personalized tutoring session. 

## Experimental results

To establish the student's preference for the AI homework, we conducted a pre-registered randomized control trial that split Rob's class into a treatment group and a control group for each assignment. We then assigned an AI version of the homework to the treatment group and an RMarkdown version to the control group. The two versions of the homework comprised the same exercises, and both had an AI component, as Rob recommended working through the RMarkdown file with ChatGPT. Accordingly, the experiment compared the experience of doing homework with a custom-made AI agent, like the one on the left, with the experience of doing homework with base ChatGPT (which is the true benchmark, as most students use AIs for homework). 

For each randomly assigned homework, we asked students, "Please rate your experience with the homework assignment" from 1 (very negative experience) to 5 (very positive experience), and "How helpful do you think this assignment was for your quiz preparation?" ranked from 1 (very unhelpful) to 5 (very helpful). Here's the distribution of survey responses:

![](https://www.dropbox.com/scl/fi/df2e6dqzesoxh0dogu4n3/ai_hw_is_better.jpg?rlkey=31vuk30p5dqwolokdhaf72n4p&dl=1)

This graph clearly distinguishes between AI-as-black-box and AI-as-tutor. Indeed, as [Bray (2024)](https://pubsonline.informs.org/doi/abs/10.1287/inte.2023.0053) for a concrete example) reports: 

> Only 19% and 5.3% of compulsory and elective students, respectively, disagreed even slightly with the statement "I believe that the interactive ChatGPT homeworks were a real strength of the class." Let that sink in: Only 1 in 5 compulsory students and 1 in 20 elective students rejected the claim that problem sets were a "real strength of the class"---*problem sets*---a real *strength* of the class.   

## What makes AI homeworks so good?

Or, more to the point, why do custom-made AIs so drastically outperform base AI models when these base models are capable of generating and explaining the correct answer? The answer is as simple as this: an AI assignment, like the one on the left, is a thoughtfully curated experience. The student knows that the professor crafted this specific AI for this specific assignment---and that the professor did so with them in mind. The AI agent provides a guided tour through the material---indeed, the difference between working with a custom-made AI agent and working with a base model is like the difference between a tour guide and a tour book.

To make the benefit of a guided tour more concrete, consider the problem of climbing down a very long ladder. In this case, a guide would caution you not to look down but instead focus on climbing one rung at a time. Just so, the AI agent won't show you all problems at once, lest you get vertigo. Instead, it'll present one problem at a time so that you can focus on the next rung of the ladder.

Further, an AI agent views a given problem in context to guide a student toward the teacher's answer with the teacher's notation. For example, an LLM will invariably characterize Little's law in terms of variables L, λ, and W, whereas our core operations class uses T, R, and I. More impressively, the AI can express the solution in terms of *student's notation*, as [Bray (2024)](https://pubsonline.informs.org/doi/abs/10.1287/inte.2023.0053) for a concrete example) documents: 

> The student answers the first question correctly, which the chatbot recognizes, despite the student's solution differing from the solution I provided in the GPT prompt. My answer was crisper than the student's answer, but the AI didn't consider the differences worth mentioning. Contrast this with how the chatbot responds to the student's second solution. The student's second answer is correct but is notably less elegant than [the answer key solution.] Unlike before, the chatbot now offers two improvements: use `as.integer()` only once by doing the arithmetic with the dates, and replace the `mutate()`, `select()`, and `distinct()` calls with `summarise()`. As you see, the chatbot effectively discerned which solution to criticize: It intervened for the second answer, which it could improve meaningfully, but not for the first answer, which it could improve only negligibly. 
>
> More importantly, note how the chatbot presents its feedback. Rather than share the answer key solution, as I would have, it *incorporates the improvements into the student's code*. For example, it refrained from replacing the unartful `filter(closed & treated)` and `group_by(cid)` with the more graceful `filter(closed, treated)` and `.by = cid`. Rather than make the student's code perfect, it restrained itself to the most critical recommendations.
>
> After the GPT shared its version of the student's code, the student asked, "why is ungroup necessary at the end." The GPT was unprepared for this question---my prompt said nothing about `ungroup()`---yet it answered splendidly. Such impromptu discussions elevate these problem sets to true tutoring sessions.

The quote above also demonstrates the AI's capacity to judiciously decide when to intervene. Suppose a student submitted mediocre answers for the first part of an assignment and submitted poor answers for the second part. A savvy tutor wouldn't say, "All your answers need improvement: you did only OK in the first part, and you did badly in the second part"; a savvy tutor would instead say, "This is a great start: you did well on the first part, but we need to work on the second part." Distributing an answer key broadcasts the first message---students are discouraged to see how they fell short on each question. In contrast, AI agents behave like the savvy tutor, criticizing only the solutions that most need fixing. 

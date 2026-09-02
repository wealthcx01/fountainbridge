# FB-172 — the graph, on screen

**Status:** Open · **Phase:** 3 · **Depends on:** FB-171 · **Raised by:** John, 2026-09-02

## Why

John: *"Implement a graphical one so we can fully realise ActiveGraph."*

FB-132 already renders a trail — what happened to one ticket, as a list of hops. The design calls it
*"Follow the change · the ActiveGraph trail"* and states the constraint the whole surface lives by:
**"Every hop is the same event ActiveGraph recorded: nothing shown here can disagree with what ran."**

A list is the right shape for one ticket. It is the wrong shape for the question a founder actually
has, which is *how does this venture hang together* — what depends on what, what is blocked behind
what, where did this decision come from. That is a graph, and drawing it as a graph is not
decoration: the dependency structure is invisible in a list.

## Scope

Not a generic graph explorer. Three specific views, each answering a question a founder has asked:

1. **What is blocked behind what.** Objects are tickets and approvals; edges are `depends_on` and
   `blocks`. This is the office and the queue, drawn as structure rather than as counts.
2. **Where this came from.** Given any ticket, walk back through the events to the conversation, the
   document, the founder decision that produced it. FB-156 supplies the document→work edge; FB-132
   supplies the hops.
3. **What if I had refused.** ActiveGraph's fork-and-diff, rendered: two runs side by side with the
   structural difference marked. This is the one thing here that cannot be built any other way, and
   it is the reason for FB-171.

Constraints:

- **Same events as everything else.** The plate, the ledger, the trail and this view are one array
  rendered four ways. FB-139's rule, and FB-149's failure, and FB-167's: two surfaces answering one
  question from two sources will disagree, and this one is the most persuasive-looking of the four.
- **Every node has a text twin.** A graph is a picture, and a picture is state a screen-reader user
  does not get. The design contract already requires this and FB-139 already does it — the ledger
  beside the office is exactly the pattern to copy.
- **It must fit a phone** (FB-138's pocket studio). A force-directed cloud does not. Prefer a layered
  dependency layout that degrades to an indented list at narrow widths, rather than a canvas that
  becomes useless below 400px.
- Render from the read model (FB-170), never by walking git per page load.

## Acceptance criteria

- [ ] A founder can see, for one venture, what is blocked behind what, and press through to any node.
- [ ] Any ticket can be walked back to the conversation or document that produced it.
- [ ] Two runs can be forked and compared, with the difference shown.
- [ ] Every node and edge is available as text, and the phone layout is usable.
- [ ] A test proves this view and the desk's ledger are built from the same array.
